"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.ResearcherRepository = void 0;
var Bootstrap_1 = require("../Bootstrap");
var Bootstrap_2 = require("../Bootstrap");
var ResearcherRepository = /** @class */ (function () {
    function ResearcherRepository() {
    }
    ResearcherRepository.prototype._select = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!!id) return [3 /*break*/, 2];
                        return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("researcher").find({ _deleted: false, _id: id }).maxTimeMS(60000).toArray()];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("researcher")
                            .find({ _deleted: false })
                            .sort({ timestamp: 1 })
                            .maxTimeMS(60000)
                            .toArray()];
                    case 3:
                        _a = _b.sent();
                        _b.label = 4;
                    case 4:
                        data = _a;
                        return [2 /*return*/, data.map(function (x) { return (__assign(__assign({ id: x._id }, x), { _id: undefined, _parent: undefined, _deleted: undefined, timestamp: undefined })); })];
                }
            });
        });
    };
    ResearcherRepository.prototype._insert = function (object) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var _id, _id2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _id = (0, Bootstrap_1.uuid)();
                        //save data in Mongo
                        return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("researcher").insertOne({
                                _id: _id,
                                name: (_a = object.name) !== null && _a !== void 0 ? _a : "",
                                timestamp: new Date().getTime(),
                                _deleted: false
                            })
                            // TODO: to match legacy behavior we create a default study as well
                        ];
                    case 1:
                        //save data in Mongo
                        _c.sent();
                        _id2 = (0, Bootstrap_1.uuid)();
                        return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("study").insertOne({
                                _id: _id2,
                                _parent: _id,
                                timestamp: new Date().getTime(),
                                name: (_b = object.name) !== null && _b !== void 0 ? _b : "",
                                _deleted: false
                            })];
                    case 2:
                        _c.sent();
                        return [2 /*return*/, _id];
                }
            });
        });
    };
    ResearcherRepository.prototype._update = function (researcher_id, object) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var orig;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("researcher").findOne({ _id: researcher_id })];
                    case 1:
                        orig = _b.sent();
                        return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("researcher").findOneAndUpdate({ _id: orig._id }, { $set: { name: (_a = object.name) !== null && _a !== void 0 ? _a : orig.name } })];
                    case 2:
                        _b.sent();
                        return [2 /*return*/, {}];
                }
            });
        });
    };
    ResearcherRepository.prototype._delete = function (researcher_id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("study").updateMany({ _parent: researcher_id }, { $set: { _deleted: true } })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, Bootstrap_2.MongoClientDB.collection("researcher").updateOne({ _id: researcher_id }, { $set: { _deleted: true } })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, {}];
                }
            });
        });
    };
    return ResearcherRepository;
}());
exports.ResearcherRepository = ResearcherRepository;
