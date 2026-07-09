const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readData(modelName) {
  const filePath = path.join(DATA_DIR, `${modelName.toLowerCase()}s.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeData(modelName, data) {
  const filePath = path.join(DATA_DIR, `${modelName.toLowerCase()}s.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

class Query {
  constructor(results, modelName) {
    this.results = results;
    this.modelName = modelName;
  }

  sort(criteria) {
    if (!this.results || !Array.isArray(this.results)) return this;
    let key = '';
    let desc = false;
    if (typeof criteria === 'object') {
      key = Object.keys(criteria)[0];
      desc = criteria[key] === -1;
    } else if (typeof criteria === 'string') {
      desc = criteria.startsWith('-');
      key = desc ? criteria.substring(1) : criteria;
    }
    if (key) {
      this.results.sort((a, b) => {
        const valA = a[key] instanceof Date ? a[key] : (typeof a[key] === 'string' && !isNaN(Date.parse(a[key])) ? new Date(a[key]) : a[key]);
        const valB = b[key] instanceof Date ? b[key] : (typeof b[key] === 'string' && !isNaN(Date.parse(b[key])) ? new Date(b[key]) : b[key]);
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    }
    return this;
  }

  populate(pathStr, select) {
    if (!this.results) return this;
    const isArray = Array.isArray(this.results);
    const docs = isArray ? this.results : [this.results];

    for (const doc of docs) {
      if (pathStr.includes('.')) {
        const [parentKey, childKey] = pathStr.split('.');
        const parentVal = doc[parentKey];
        if (Array.isArray(parentVal)) {
          let refModelName = '';
          if (childKey === 'userId') refModelName = 'User';
          if (refModelName) {
            const refData = readData(refModelName);
            for (const item of parentVal) {
              const itemVal = item[childKey];
              if (itemVal) {
                const match = refData.find(d => d._id === itemVal.toString() || (d._id && d._id._id && d._id._id.toString() === itemVal.toString()));
                if (match) {
                  const populated = { ...match };
                  if (select) {
                    const fields = select.split(' ');
                    const filtered = {};
                    fields.forEach(f => {
                      if (f) filtered[f] = populated[f];
                    });
                    filtered._id = populated._id;
                    item[childKey] = filtered;
                  } else {
                    item[childKey] = populated;
                  }
                }
              }
            }
          }
        }
      } else {
        const val = doc[pathStr];
        if (val) {
          let refModelName = '';
          if (pathStr === 'hostId') refModelName = 'User';
          else if (pathStr === 'meetingId') refModelName = 'Meeting';
          else if (pathStr === 'userId') refModelName = 'User';

          if (refModelName) {
            const refData = readData(refModelName);
            const match = refData.find(d => d._id === val.toString());
            if (match) {
              const populated = { ...match };
              if (select) {
                const fields = select.split(' ');
                const filtered = {};
                fields.forEach(f => {
                  if (f) filtered[f] = populated[f];
                });
                filtered._id = populated._id;
                doc[pathStr] = filtered;
              } else {
                doc[pathStr] = populated;
              }
            }
          }
        }
      }
    }
    return this;
  }

  then(onResolve, onReject) {
    return Promise.resolve(this.results).then(onResolve, onReject);
  }

  catch(onReject) {
    return Promise.resolve(this.results).catch(onReject);
  }
}

const SchemaTypes = {
  ObjectId: String
};

class Schema {
  constructor(definition) {
    this.definition = definition;
    this.methods = {};
    this.pres = {};
  }

  pre(hookName, fn) {
    if (!this.pres[hookName]) {
      this.pres[hookName] = [];
    }
    this.pres[hookName].push(fn);
  }
}

Schema.Types = SchemaTypes;

function compileModel(modelName, schema) {
  class Model {
    constructor(data) {
      Object.assign(this, data);
      if (!this._id) {
        this._id = crypto.randomBytes(12).toString('hex');
      }
      if (schema && schema.definition) {
        for (const key in schema.definition) {
          if (this[key] === undefined) {
            const valDef = schema.definition[key];
            if (valDef && valDef.default !== undefined) {
              this[key] = typeof valDef.default === 'function' ? valDef.default() : valDef.default;
            }
          }
        }
      }
      if (schema && schema.methods) {
        for (const mName in schema.methods) {
          this[mName] = schema.methods[mName].bind(this);
        }
      }
      for (const key of Object.keys(this)) {
        if (Array.isArray(this[key])) {
          this[key] = this[key].map(item => {
            if (item && typeof item === 'object' && !item._id) {
              item._id = crypto.randomBytes(12).toString('hex');
            }
            return item;
          });
          this[key].id = function(id) {
            return this.find(item => item && (item._id === id || (item._id && item._id.toString() === id.toString())));
          };
        }
      }
    }

    isModified(field) {
      return true;
    }

    async save() {
      const preSaves = (schema && schema.pres && schema.pres['save']) || [];
      for (const fn of preSaves) {
        await new Promise((resolve, reject) => {
          fn.call(this, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const allData = readData(modelName);
      const cleanObj = {};
      for (const k of Object.keys(this)) {
        if (typeof this[k] !== 'function') {
          cleanObj[k] = this[k];
        }
      }

      const idx = allData.findIndex(d => d._id === cleanObj._id);
      if (idx !== -1) {
        allData[idx] = cleanObj;
      } else {
        allData.push(cleanObj);
      }
      writeData(modelName, allData);
      return this;
    }
  }

  Model.modelName = modelName;

  Model.find = function (query) {
    const allData = readData(modelName);
    const filtered = allData.filter(d => {
      for (const key in query) {
        if (query[key] && typeof query[key] === 'object' && query[key].toString() !== '[object Object]') {
          if (d[key] && d[key].toString() !== query[key].toString()) return false;
        } else if (d[key] !== query[key]) {
          if (d[key] && query[key] && d[key].toString() === query[key].toString()) {
            continue;
          }
          return false;
        }
      }
      return true;
    });
    const cloned = filtered.map(item => new Model(item));
    return new Query(cloned, modelName);
  };

  Model.findOne = function (query) {
    const allData = readData(modelName);
    const found = allData.find(d => {
      for (const key in query) {
        if (query[key] && typeof query[key] === 'object' && query[key].toString() !== '[object Object]') {
          if (d[key] && d[key].toString() !== query[key].toString()) return false;
        } else if (d[key] !== query[key]) {
          if (d[key] && query[key] && d[key].toString() === query[key].toString()) {
            continue;
          }
          return false;
        }
      }
      return true;
    });
    return new Query(found ? new Model(found) : null, modelName);
  };

  Model.findById = function (id) {
    if (!id) return new Query(null, modelName);
    const allData = readData(modelName);
    const found = allData.find(d => d._id === id.toString());
    return new Query(found ? new Model(found) : null, modelName);
  };

  Model.findByIdAndDelete = function (id) {
    if (!id) return new Query(null, modelName);
    const allData = readData(modelName);
    const idx = allData.findIndex(d => d._id === id.toString());
    let deleted = null;
    if (idx !== -1) {
      deleted = allData.splice(idx, 1)[0];
      writeData(modelName, allData);
    }
    return new Query(deleted ? new Model(deleted) : null, modelName);
  };

  Model.deleteMany = function (query) {
    const allData = readData(modelName);
    const kept = allData.filter(d => {
      for (const key in query) {
        if (d[key] !== query[key]) {
          if (d[key] && query[key] && d[key].toString() === query[key].toString()) {
            continue;
          }
          return true;
        }
      }
      return false;
    });
    writeData(modelName, kept);
    return Promise.resolve({ deletedCount: allData.length - kept.length });
  };

  return Model;
}

const registeredModels = {};

const mongooseMock = {
  Schema: Schema,
  model: function (name, schema) {
    if (!registeredModels[name]) {
      registeredModels[name] = compileModel(name, schema);
    }
    return registeredModels[name];
  },
  connect: function (uri, options) {
    return Promise.resolve();
  }
};

module.exports = mongooseMock;
