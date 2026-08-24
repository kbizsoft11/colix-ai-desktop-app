import H from "fs";
import J from "path";
import K from "os";
function Q(i, s) {
  for (var m = 0; m < s.length; m++) {
    const o = s[m];
    if (typeof o != "string" && !Array.isArray(o)) {
      for (const h in o)
        if (h !== "default" && !(h in i)) {
          const e = Object.getOwnPropertyDescriptor(o, h);
          e && Object.defineProperty(i, h, e.get ? e : {
            enumerable: !0,
            get: () => o[h]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(i, Symbol.toStringTag, { value: "Module" }));
}
function Z(i) {
  return i && i.__esModule && Object.prototype.hasOwnProperty.call(i, "default") ? i.default : i;
}
var D = { exports: {} };
function $(i) {
  throw new Error('Could not dynamically require "' + i + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var w = { exports: {} }, x, X;
function ee() {
  if (X) return x;
  X = 1;
  var i = H, s = J, m = K, o = typeof __webpack_require__ == "function" ? __non_webpack_require__ : $, h = process.config && process.config.variables || {}, e = !!process.env.PREBUILDS_ONLY, t = process.versions.modules, u = L() ? "electron" : G() ? "node-webkit" : "node", a = process.env.npm_config_arch || m.arch(), p = process.env.npm_config_platform || m.platform(), y = process.env.LIBC || (U(p) ? "musl" : "glibc"), _ = process.env.ARM_VERSION || (a === "arm64" ? "8" : h.arm_version) || "", k = (process.versions.uv || "").split(".")[0];
  x = v;
  function v(r) {
    return o(v.resolve(r));
  }
  v.resolve = v.path = function(r) {
    r = s.resolve(r || ".");
    try {
      var c = o(s.join(r, "package.json")).name.toUpperCase().replace(/-/g, "_");
      process.env[c + "_PREBUILD"] && (r = process.env[c + "_PREBUILD"]);
    } catch {
    }
    if (!e) {
      var n = I(s.join(r, "build/Release"), P);
      if (n) return n;
      var l = I(s.join(r, "build/Debug"), P);
      if (l) return l;
    }
    var d = S(r);
    if (d) return d;
    var f = S(s.dirname(process.execPath));
    if (f) return f;
    var F = [
      "platform=" + p,
      "arch=" + a,
      "runtime=" + u,
      "abi=" + t,
      "uv=" + k,
      _ ? "armv=" + _ : "",
      "libc=" + y,
      "node=" + process.versions.node,
      process.versions.electron ? "electron=" + process.versions.electron : "",
      typeof __webpack_require__ == "function" ? "webpack=true" : ""
      // eslint-disable-line
    ].filter(Boolean).join(" ");
    throw new Error("No native build was found for " + F + `
    loaded from: ` + r + `
`);
    function S(g) {
      var z = b(s.join(g, "prebuilds")).map(q), N = z.filter(C(p, a)).sort(T)[0];
      if (N) {
        var O = s.join(g, "prebuilds", N.name), V = b(O).map(B), W = V.filter(R(u, t)), Y = W.sort(E(u))[0];
        if (Y) return s.join(O, Y.file);
      }
    }
  };
  function b(r) {
    try {
      return i.readdirSync(r);
    } catch {
      return [];
    }
  }
  function I(r, c) {
    var n = b(r).filter(c);
    return n[0] && s.join(r, n[0]);
  }
  function P(r) {
    return /\.node$/.test(r);
  }
  function q(r) {
    var c = r.split("-");
    if (c.length === 2) {
      var n = c[0], l = c[1].split("+");
      if (n && l.length && l.every(Boolean))
        return { name: r, platform: n, architectures: l };
    }
  }
  function C(r, c) {
    return function(n) {
      return n == null || n.platform !== r ? !1 : n.architectures.includes(c);
    };
  }
  function T(r, c) {
    return r.architectures.length - c.architectures.length;
  }
  function B(r) {
    var c = r.split("."), n = c.pop(), l = { file: r, specificity: 0 };
    if (n === "node") {
      for (var d = 0; d < c.length; d++) {
        var f = c[d];
        if (f === "node" || f === "electron" || f === "node-webkit")
          l.runtime = f;
        else if (f === "napi")
          l.napi = !0;
        else if (f.slice(0, 3) === "abi")
          l.abi = f.slice(3);
        else if (f.slice(0, 2) === "uv")
          l.uv = f.slice(2);
        else if (f.slice(0, 4) === "armv")
          l.armv = f.slice(4);
        else if (f === "glibc" || f === "musl")
          l.libc = f;
        else
          continue;
        l.specificity++;
      }
      return l;
    }
  }
  function R(r, c) {
    return function(n) {
      return !(n == null || n.runtime && n.runtime !== r && !A(n) || n.abi && n.abi !== c && !n.napi || n.uv && n.uv !== k || n.armv && n.armv !== _ || n.libc && n.libc !== y);
    };
  }
  function A(r) {
    return r.runtime === "node" && r.napi;
  }
  function E(r) {
    return function(c, n) {
      return c.runtime !== n.runtime ? c.runtime === r ? -1 : 1 : c.abi !== n.abi ? c.abi ? -1 : 1 : c.specificity !== n.specificity ? c.specificity > n.specificity ? -1 : 1 : 0;
    };
  }
  function G() {
    return !!(process.versions && process.versions.nw);
  }
  function L() {
    return process.versions && process.versions.electron || process.env.ELECTRON_RUN_AS_NODE ? !0 : typeof window < "u" && window.process && window.process.type === "renderer";
  }
  function U(r) {
    return r === "linux" && i.existsSync("/etc/alpine-release");
  }
  return v.parseTags = B, v.matchTags = R, v.compareTags = E, v.parseTuple = q, v.matchTuple = C, v.compareTuples = T, x;
}
const j = typeof __webpack_require__ == "function" ? __non_webpack_require__ : $;
typeof j.addon == "function" ? w.exports = j.addon.bind(j) : w.exports = ee();
var re = w.exports;
(function(i) {
  const s = re(__dirname);
  i.exports = s, i.exports.screen = {}, i.exports.image = {};
  function m(e, t, u, a, p, y) {
    typeof e == "object" && e !== null && (this.screenX = e.screenX, this.screenY = e.screenY, this.scaleX = e.scaleX, this.scaleY = e.scaleY, y = e.image, p = e.bytesPerPixel, a = e.bitsPerPixel, u = e.byteWidth, t = e.height, e = e.width), this.width = e, this.height = t, this.byteWidth = u, this.bitsPerPixel = a, this.bytesPerPixel = p, this.image = y;
  }
  function o(e, t, u, a, p, y) {
    m.call(this, e, t, u, a, p, y);
  }
  o.prototype = m.prototype, o.prototype.constructor = o;
  function h(e) {
    return !e || typeof e != "object" ? { width: 0, height: 0 } : typeof e.width == "number" && typeof e.height == "number" ? { width: e.width, height: e.height } : { width: 0, height: 0 };
  }
  o.prototype.colorAt = function(e, t) {
    return s.getColor(this, e, t);
  }, o.prototype.findColor = function(e, t) {
    return s.findColor(this, e, t);
  }, o.prototype.findColors = function(e, t) {
    return s.findColors(this, e, t);
  }, o.prototype.countColor = function(e, t) {
    return s.countColor(this, e, t);
  }, o.prototype.findImage = function(e, t) {
    return s.findImage(this, e, t);
  }, o.prototype.findImages = function(e, t) {
    return s.findImages(this, e, t);
  }, o.prototype.countImage = function(e, t) {
    return s.countImage(this, e, t);
  }, o.prototype.save = function(e) {
    return s.saveImage(this, e);
  }, o.prototype.toScreenPoint = function(e, t) {
    var u = h(t), a = typeof this.scaleX == "number" && this.scaleX > 0 ? this.scaleX : 1, p = typeof this.scaleY == "number" && this.scaleY > 0 ? this.scaleY : 1, y = typeof this.screenX == "number" ? this.screenX : 0, _ = typeof this.screenY == "number" ? this.screenY : 0;
    return {
      x: Math.round(y + (e.x + Math.floor(u.width / 2)) / a),
      y: Math.round(_ + (e.y + Math.floor(u.height / 2)) / p)
    };
  }, o.prototype.click = function(e, t, u, a) {
    var p = this.toScreenPoint(e, t);
    return i.exports.moveMouse(p.x, p.y), typeof u > "u" && typeof a > "u" ? i.exports.mouseClick() : typeof u > "u" ? i.exports.mouseClick("left", a) : typeof a > "u" ? i.exports.mouseClick(u) : i.exports.mouseClick(u, a), p;
  }, o.prototype.clickImage = function(e, t, u, a) {
    var p = this.findImage(e, t);
    return p ? (this.click(p, e, u, a), p) : null;
  }, i.exports.Image = o, i.exports.Bitmap = o, i.exports.screen.capture = function(e, t, u, a) {
    return typeof e < "u" && typeof t < "u" && typeof u < "u" && typeof a < "u" ? new o(s.captureScreen(e, t, u, a)) : new o(s.captureScreen());
  }, i.exports.image.load = function(e) {
    return new o(s.loadImage(e));
  }, i.exports.image.save = function(e, t) {
    return s.saveImage(e, t);
  }, i.exports.image.supportsPNG = !!s.hasPNGSupport;
})(D);
var M = D.exports;
const ne = /* @__PURE__ */ Z(M), se = /* @__PURE__ */ Q({
  __proto__: null,
  default: ne
}, [M]);
export {
  se as i
};
