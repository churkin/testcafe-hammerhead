import fs from 'fs';
import mime from 'mime';
import path from 'path';
import Promise from 'promise';

var readFile  = Promise.denodeify(fs.readFile);
var stat      = Promise.denodeify(fs.stat);
var writeFile = Promise.denodeify(fs.writeFile);

export default class UploadStorage {
    constructor (storagePath) {
        this.storageFolder = storagePath;
    }

    async _loadFile (filePath) {
        var fileContent = await readFile(filePath);
        var stats       = await stat(filePath);

        return {
            data: fileContent.toString('base64'),
            info: {
                lastModifiedDate: stats.mtime,
                name:             path.basename(filePath),
                type:             mime.lookup(filePath)
            }
        };
    }

    _createProcessTask (fileName, processor) {
        return (async () => {
            var resolvedPath = path.resolve(this.storageFolder, fileName);

            try {
                return await processor(resolvedPath, fileName);
            }
            catch (e) {
                return {
                    err:  e.toString(),
                    path: resolvedPath
                };
            }
        })();
    }

    async _processFiles (fileNames, processor) {
        var processTasks = fileNames.map(fileName => this._createProcessTask(fileName, processor));

        var result = await Promise.all(processTasks);

        result = result.filter(value => !!value);

        return result.length ? result : null;
    }

    async store (fileNames, data) {
        return await this._processFiles(fileNames, async (resolvedPath, fileName) => {
            var content = new Buffer(data[fileNames.indexOf(fileName)], 'base64');

            await writeFile(resolvedPath, content);
        });
    }

    async get (paths) {
        return await this._processFiles(paths, async (resolvedPath) => {
            return await this._loadFile(resolvedPath);
        });
    }
}
