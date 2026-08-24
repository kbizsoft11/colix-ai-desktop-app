import require$$0 from "fs";
import require$$1 from "path";
import require$$2 from "os";
function _mergeNamespaces(n, m) {
  for (var i = 0; i < m.length; i++) {
    const e = m[i];
    if (typeof e !== "string" && !Array.isArray(e)) {
      for (const k in e) {
        if (k !== "default" && !(k in n)) {
          const d = Object.getOwnPropertyDescriptor(e, k);
          if (d) {
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: () => e[k]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var robotjs = { exports: {} };
function commonjsRequire(path) {
  throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var nodeGypBuild$1 = { exports: {} };
var nodeGypBuild;
var hasRequiredNodeGypBuild;
function requireNodeGypBuild() {
  if (hasRequiredNodeGypBuild) return nodeGypBuild;
  hasRequiredNodeGypBuild = 1;
  var fs = require$$0;
  var path = require$$1;
  var os = require$$2;
  var runtimeRequire2 = typeof __webpack_require__ === "function" ? __non_webpack_require__ : commonjsRequire;
  var vars = process.config && process.config.variables || {};
  var prebuildsOnly = !!process.env.PREBUILDS_ONLY;
  var abi = process.versions.modules;
  var runtime = isElectron() ? "electron" : isNwjs() ? "node-webkit" : "node";
  var arch = process.env.npm_config_arch || os.arch();
  var platform = process.env.npm_config_platform || os.platform();
  var libc = process.env.LIBC || (isAlpine(platform) ? "musl" : "glibc");
  var armv = process.env.ARM_VERSION || (arch === "arm64" ? "8" : vars.arm_version) || "";
  var uv = (process.versions.uv || "").split(".")[0];
  nodeGypBuild = load;
  function load(dir) {
    return runtimeRequire2(load.resolve(dir));
  }
  load.resolve = load.path = function(dir) {
    dir = path.resolve(dir || ".");
    try {
      var name = runtimeRequire2(path.join(dir, "package.json")).name.toUpperCase().replace(/-/g, "_");
      if (process.env[name + "_PREBUILD"]) dir = process.env[name + "_PREBUILD"];
    } catch (err) {
    }
    if (!prebuildsOnly) {
      var release = getFirst(path.join(dir, "build/Release"), matchBuild);
      if (release) return release;
      var debug = getFirst(path.join(dir, "build/Debug"), matchBuild);
      if (debug) return debug;
    }
    var prebuild = resolve(dir);
    if (prebuild) return prebuild;
    var nearby = resolve(path.dirname(process.execPath));
    if (nearby) return nearby;
    var target = [
      "platform=" + platform,
      "arch=" + arch,
      "runtime=" + runtime,
      "abi=" + abi,
      "uv=" + uv,
      armv ? "armv=" + armv : "",
      "libc=" + libc,
      "node=" + process.versions.node,
      process.versions.electron ? "electron=" + process.versions.electron : "",
      typeof __webpack_require__ === "function" ? "webpack=true" : ""
      // eslint-disable-line
    ].filter(Boolean).join(" ");
    throw new Error("No native build was found for " + target + "\n    loaded from: " + dir + "\n");
    function resolve(dir2) {
      var tuples = readdirSync(path.join(dir2, "prebuilds")).map(parseTuple);
      var tuple = tuples.filter(matchTuple(platform, arch)).sort(compareTuples)[0];
      if (!tuple) return;
      var prebuilds = path.join(dir2, "prebuilds", tuple.name);
      var parsed = readdirSync(prebuilds).map(parseTags);
      var candidates = parsed.filter(matchTags(runtime, abi));
      var winner = candidates.sort(compareTags(runtime))[0];
      if (winner) return path.join(prebuilds, winner.file);
    }
  };
  function readdirSync(dir) {
    try {
      return fs.readdirSync(dir);
    } catch (err) {
      return [];
    }
  }
  function getFirst(dir, filter) {
    var files = readdirSync(dir).filter(filter);
    return files[0] && path.join(dir, files[0]);
  }
  function matchBuild(name) {
    return /\.node$/.test(name);
  }
  function parseTuple(name) {
    var arr = name.split("-");
    if (arr.length !== 2) return;
    var platform2 = arr[0];
    var architectures = arr[1].split("+");
    if (!platform2) return;
    if (!architectures.length) return;
    if (!architectures.every(Boolean)) return;
    return { name, platform: platform2, architectures };
  }
  function matchTuple(platform2, arch2) {
    return function(tuple) {
      if (tuple == null) return false;
      if (tuple.platform !== platform2) return false;
      return tuple.architectures.includes(arch2);
    };
  }
  function compareTuples(a, b) {
    return a.architectures.length - b.architectures.length;
  }
  function parseTags(file) {
    var arr = file.split(".");
    var extension = arr.pop();
    var tags = { file, specificity: 0 };
    if (extension !== "node") return;
    for (var i = 0; i < arr.length; i++) {
      var tag = arr[i];
      if (tag === "node" || tag === "electron" || tag === "node-webkit") {
        tags.runtime = tag;
      } else if (tag === "napi") {
        tags.napi = true;
      } else if (tag.slice(0, 3) === "abi") {
        tags.abi = tag.slice(3);
      } else if (tag.slice(0, 2) === "uv") {
        tags.uv = tag.slice(2);
      } else if (tag.slice(0, 4) === "armv") {
        tags.armv = tag.slice(4);
      } else if (tag === "glibc" || tag === "musl") {
        tags.libc = tag;
      } else {
        continue;
      }
      tags.specificity++;
    }
    return tags;
  }
  function matchTags(runtime2, abi2) {
    return function(tags) {
      if (tags == null) return false;
      if (tags.runtime && tags.runtime !== runtime2 && !runtimeAgnostic(tags)) return false;
      if (tags.abi && tags.abi !== abi2 && !tags.napi) return false;
      if (tags.uv && tags.uv !== uv) return false;
      if (tags.armv && tags.armv !== armv) return false;
      if (tags.libc && tags.libc !== libc) return false;
      return true;
    };
  }
  function runtimeAgnostic(tags) {
    return tags.runtime === "node" && tags.napi;
  }
  function compareTags(runtime2) {
    return function(a, b) {
      if (a.runtime !== b.runtime) {
        return a.runtime === runtime2 ? -1 : 1;
      } else if (a.abi !== b.abi) {
        return a.abi ? -1 : 1;
      } else if (a.specificity !== b.specificity) {
        return a.specificity > b.specificity ? -1 : 1;
      } else {
        return 0;
      }
    };
  }
  function isNwjs() {
    return !!(process.versions && process.versions.nw);
  }
  function isElectron() {
    if (process.versions && process.versions.electron) return true;
    if (process.env.ELECTRON_RUN_AS_NODE) return true;
    return typeof window !== "undefined" && window.process && window.process.type === "renderer";
  }
  function isAlpine(platform2) {
    return platform2 === "linux" && fs.existsSync("/etc/alpine-release");
  }
  load.parseTags = parseTags;
  load.matchTags = matchTags;
  load.compareTags = compareTags;
  load.parseTuple = parseTuple;
  load.matchTuple = matchTuple;
  load.compareTuples = compareTuples;
  return nodeGypBuild;
}
const runtimeRequire = typeof __webpack_require__ === "function" ? __non_webpack_require__ : commonjsRequire;
if (typeof runtimeRequire.addon === "function") {
  nodeGypBuild$1.exports = runtimeRequire.addon.bind(runtimeRequire);
} else {
  nodeGypBuild$1.exports = requireNodeGypBuild();
}
var nodeGypBuildExports = nodeGypBuild$1.exports;
(function(module) {
  const robotjs2 = nodeGypBuildExports(__dirname);
  module.exports = robotjs2;
  module.exports.screen = {};
  module.exports.image = {};
  function Bitmap(width, height, byteWidth, bitsPerPixel, bytesPerPixel, image) {
    if (typeof width === "object" && width !== null) {
      this.screenX = width.screenX;
      this.screenY = width.screenY;
      this.scaleX = width.scaleX;
      this.scaleY = width.scaleY;
      image = width.image;
      bytesPerPixel = width.bytesPerPixel;
      bitsPerPixel = width.bitsPerPixel;
      byteWidth = width.byteWidth;
      height = width.height;
      width = width.width;
    }
    this.width = width;
    this.height = height;
    this.byteWidth = byteWidth;
    this.bitsPerPixel = bitsPerPixel;
    this.bytesPerPixel = bytesPerPixel;
    this.image = image;
  }
  function Image(width, height, byteWidth, bitsPerPixel, bytesPerPixel, image) {
    Bitmap.call(this, width, height, byteWidth, bitsPerPixel, bytesPerPixel, image);
  }
  Image.prototype = Bitmap.prototype;
  Image.prototype.constructor = Image;
  function getTargetDimensions(target) {
    if (!target || typeof target !== "object") {
      return { width: 0, height: 0 };
    }
    if (typeof target.width === "number" && typeof target.height === "number") {
      return { width: target.width, height: target.height };
    }
    return { width: 0, height: 0 };
  }
  Image.prototype.colorAt = function(x, y) {
    return robotjs2.getColor(this, x, y);
  };
  Image.prototype.findColor = function(color, options) {
    return robotjs2.findColor(this, color, options);
  };
  Image.prototype.findColors = function(color, options) {
    return robotjs2.findColors(this, color, options);
  };
  Image.prototype.countColor = function(color, options) {
    return robotjs2.countColor(this, color, options);
  };
  Image.prototype.findImage = function(needle, options) {
    return robotjs2.findImage(this, needle, options);
  };
  Image.prototype.findImages = function(needle, options) {
    return robotjs2.findImages(this, needle, options);
  };
  Image.prototype.countImage = function(needle, options) {
    return robotjs2.countImage(this, needle, options);
  };
  Image.prototype.save = function(path) {
    return robotjs2.saveImage(this, path);
  };
  Image.prototype.toScreenPoint = function(point, target) {
    var dimensions = getTargetDimensions(target);
    var scaleX = typeof this.scaleX === "number" && this.scaleX > 0 ? this.scaleX : 1;
    var scaleY = typeof this.scaleY === "number" && this.scaleY > 0 ? this.scaleY : 1;
    var screenX = typeof this.screenX === "number" ? this.screenX : 0;
    var screenY = typeof this.screenY === "number" ? this.screenY : 0;
    return {
      x: Math.round(screenX + (point.x + Math.floor(dimensions.width / 2)) / scaleX),
      y: Math.round(screenY + (point.y + Math.floor(dimensions.height / 2)) / scaleY)
    };
  };
  Image.prototype.click = function(point, target, button, double) {
    var screenPoint = this.toScreenPoint(point, target);
    module.exports.moveMouse(screenPoint.x, screenPoint.y);
    if (typeof button === "undefined" && typeof double === "undefined") {
      module.exports.mouseClick();
    } else if (typeof button === "undefined") {
      module.exports.mouseClick("left", double);
    } else if (typeof double === "undefined") {
      module.exports.mouseClick(button);
    } else {
      module.exports.mouseClick(button, double);
    }
    return screenPoint;
  };
  Image.prototype.clickImage = function(target, options, button, double) {
    var match = this.findImage(target, options);
    if (!match) {
      return null;
    }
    this.click(match, target, button, double);
    return match;
  };
  module.exports.Image = Image;
  module.exports.Bitmap = Image;
  module.exports.screen.capture = function(x, y, width, height) {
    if (typeof x !== "undefined" && typeof y !== "undefined" && typeof width !== "undefined" && typeof height !== "undefined") {
      return new Image(robotjs2.captureScreen(x, y, width, height));
    }
    return new Image(robotjs2.captureScreen());
  };
  module.exports.image.load = function(path) {
    return new Image(robotjs2.loadImage(path));
  };
  module.exports.image.save = function(bitmap, path) {
    return robotjs2.saveImage(bitmap, path);
  };
  module.exports.image.supportsPNG = !!robotjs2.hasPNGSupport;
})(robotjs);
var robotjsExports = robotjs.exports;
const index = /* @__PURE__ */ getDefaultExportFromCjs(robotjsExports);
const index$1 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: index
}, [robotjsExports]);
export {
  index$1 as i
};
