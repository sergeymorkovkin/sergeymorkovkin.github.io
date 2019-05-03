var debug = false;
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enableBodyScroll = exports.clearAllBodyScrollLocks = exports.disableBodyScroll = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// Older browsers don't support event options, feature detect it.
// Adopted and modified solution from Bohdan Didukh (2017)
// https://stackoverflow.com/questions/41594997/ios-10-safari-prevent-scrolling-behind-a-fixed-overlay-and-maintain-scroll-posi
var hasPassiveEvents = false;

if (typeof window !== 'undefined') {
  var passiveTestOptions = {
    get passive() {
      hasPassiveEvents = true;
      return undefined;
    }

  };
  window.addEventListener('testPassive', null, passiveTestOptions);
  window.removeEventListener('testPassive', null, passiveTestOptions);
}

var isIosDevice = typeof window !== 'undefined' && window.navigator && window.navigator.platform && /iP(ad|hone|od)/.test(window.navigator.platform);
var locks = [];
var documentListenerAdded = false;
var initialClientY = -1;
var previousBodyOverflowSetting;
var previousBodyPaddingRight; // returns true if `el` should be allowed to receive touchmove events

var allowTouchMove = function allowTouchMove(el) {
  return locks.some(function (lock) {
    if (lock.options.allowTouchMove && lock.options.allowTouchMove(el)) {
      return true;
    }

    return false;
  });
};

var preventDefault = function preventDefault(rawEvent) {
  var e = rawEvent || window.event; // For the case whereby consumers adds a touchmove event listener to document.
  // Recall that we do document.addEventListener('touchmove', preventDefault, { passive: false })
  // in disableBodyScroll - so if we provide this opportunity to allowTouchMove, then
  // the touchmove event on document will break.

  if (allowTouchMove(e.target)) {
    return true;
  } // Do not prevent if the event has more than one touch (usually meaning this is a multi touch gesture like pinch to zoom)


  if (e.touches.length > 1) return true;
  if (e.preventDefault) e.preventDefault();
  return false;
};

var setOverflowHidden = function setOverflowHidden(options) {
  // Setting overflow on body/documentElement synchronously in Desktop Safari slows down
  // the responsiveness for some reason. Setting within a setTimeout fixes this.
  setTimeout(function () {
    // If previousBodyPaddingRight is already set, don't set it again.
    if (previousBodyPaddingRight === undefined) {
      var reserveScrollBarGap = !!options && options.reserveScrollBarGap === true;
      var scrollBarGap = window.innerWidth - document.documentElement.clientWidth;

      if (reserveScrollBarGap && scrollBarGap > 0) {
        previousBodyPaddingRight = document.body.style.paddingRight;
        document.body.style.paddingRight = "".concat(scrollBarGap, "px");
      }
    } // If previousBodyOverflowSetting is already set, don't set it again.


    if (previousBodyOverflowSetting === undefined) {
      previousBodyOverflowSetting = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  });
};

var restoreOverflowSetting = function restoreOverflowSetting() {
  // Setting overflow on body/documentElement synchronously in Desktop Safari slows down
  // the responsiveness for some reason. Setting within a setTimeout fixes this.
  setTimeout(function () {
    if (previousBodyPaddingRight !== undefined) {
      document.body.style.paddingRight = previousBodyPaddingRight; // Restore previousBodyPaddingRight to undefined so setOverflowHidden knows it
      // can be set again.

      previousBodyPaddingRight = undefined;
    }

    if (previousBodyOverflowSetting !== undefined) {
      document.body.style.overflow = previousBodyOverflowSetting; // Restore previousBodyOverflowSetting to undefined
      // so setOverflowHidden knows it can be set again.

      previousBodyOverflowSetting = undefined;
    }
  });
}; // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#Problems_and_solutions


var isTargetElementTotallyScrolled = function isTargetElementTotallyScrolled(targetElement) {
  return targetElement ? targetElement.scrollHeight - targetElement.scrollTop <= targetElement.clientHeight : false;
};

var handleScroll = function handleScroll(event, targetElement) {
  var clientY = event.targetTouches[0].clientY - initialClientY;

  if (allowTouchMove(event.target)) {
    return false;
  }

  if (targetElement && targetElement.scrollTop === 0 && clientY > 0) {
    // element is at the top of its scroll
    return preventDefault(event);
  }

  if (isTargetElementTotallyScrolled(targetElement) && clientY < 0) {
    // element is at the top of its scroll
    return preventDefault(event);
  }

  event.stopPropagation();
  return true;
};

var disableBodyScroll = function disableBodyScroll(targetElement, options) {
  if (isIosDevice) {
    // targetElement must be provided, and disableBodyScroll must not have been
    // called on this targetElement before.
    if (!targetElement) {
      // eslint-disable-next-line no-console
      console.error('disableBodyScroll unsuccessful - targetElement must be provided when calling disableBodyScroll on IOS devices.');
      return;
    }

    if (targetElement && !locks.some(function (lock) {
      return lock.targetElement === targetElement;
    })) {
      var lock = {
        targetElement: targetElement,
        options: options || {}
      };
      locks = [].concat(_toConsumableArray(locks), [lock]);

      targetElement.ontouchstart = function (event) {
        if (event.targetTouches.length === 1) {
          // detect single touch
          initialClientY = event.targetTouches[0].clientY;
        }
      };

      targetElement.ontouchmove = function (event) {
        if (event.targetTouches.length === 1) {
          // detect single touch
          handleScroll(event, targetElement);
        }
      };

      if (!documentListenerAdded) {
        document.addEventListener('touchmove', preventDefault, hasPassiveEvents ? {
          passive: false
        } : undefined);
        documentListenerAdded = true;
      }
    }
  } else {
    setOverflowHidden(options);
    var _lock = {
      targetElement: targetElement,
      options: options || {}
    };
    locks = [].concat(_toConsumableArray(locks), [_lock]);
  }
};

exports.disableBodyScroll = disableBodyScroll;

var clearAllBodyScrollLocks = function clearAllBodyScrollLocks() {
  if (isIosDevice) {
    // Clear all locks ontouchstart/ontouchmove handlers, and the references
    locks.forEach(function (lock) {
      lock.targetElement.ontouchstart = null;
      lock.targetElement.ontouchmove = null;
    });

    if (documentListenerAdded) {
      document.removeEventListener('touchmove', preventDefault, hasPassiveEvents ? {
        passive: false
      } : undefined);
      documentListenerAdded = false;
    }

    locks = []; // Reset initial clientY

    initialClientY = -1;
  } else {
    restoreOverflowSetting();
    locks = [];
  }
};

exports.clearAllBodyScrollLocks = clearAllBodyScrollLocks;

var enableBodyScroll = function enableBodyScroll(targetElement) {
  if (isIosDevice) {
    if (!targetElement) {
      // eslint-disable-next-line no-console
      console.error('enableBodyScroll unsuccessful - targetElement must be provided when calling enableBodyScroll on IOS devices.');
      return;
    }

    targetElement.ontouchstart = null;
    targetElement.ontouchmove = null;
    locks = locks.filter(function (lock) {
      return lock.targetElement !== targetElement;
    });

    if (documentListenerAdded && locks.length === 0) {
      document.removeEventListener('touchmove', preventDefault, hasPassiveEvents ? {
        passive: false
      } : undefined);
      documentListenerAdded = false;
    }
  } else if (locks.length === 1 && locks[0].targetElement === targetElement) {
    restoreOverflowSetting();
    locks = [];
  } else {
    locks = locks.filter(function (lock) {
      return lock.targetElement !== targetElement;
    });
  }
};

exports.enableBodyScroll = enableBodyScroll;

},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var detectHover = {
  update: function update() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      detectHover.hover = window.matchMedia('(hover: hover)').matches;
      detectHover.none = window.matchMedia('(hover: none)').matches || window.matchMedia('(hover: on-demand)').matches;
      detectHover.anyHover = window.matchMedia('(any-hover: hover)').matches;
      detectHover.anyNone = window.matchMedia('(any-hover: none)').matches || window.matchMedia('(any-hover: on-demand)').matches;
    }
  }
};
detectHover.update();
exports.default = detectHover;

},{}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _detectHover = _interopRequireDefault(require("detect-hover"));

var _detectPointer = _interopRequireDefault(require("detect-pointer"));

var _detectTouchEvents = _interopRequireDefault(require("detect-touch-events"));

var _detectPassiveEvents = _interopRequireDefault(require("detect-passive-events"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * detectIt object structure
 * const detectIt = {
 *   deviceType: 'mouseOnly' / 'touchOnly' / 'hybrid',
 *   passiveEvents: boolean,
 *   hasTouch: boolean,
 *   hasMouse: boolean,
 *   maxTouchPoints: number,
 *   primaryHover: 'hover' / 'none',
 *   primaryPointer: 'fine' / 'coarse' / 'none',
 *   state: {
 *     detectHover,
 *     detectPointer,
 *     detectTouchEvents,
 *     detectPassiveEvents,
 *   },
 *   update() {...},
 * }
 */
function determineDeviceType(hasTouch, anyHover, anyFine, state) {
  // A hybrid device is one that both hasTouch and any input device can hover
  // or has a fine pointer.
  if (hasTouch && (anyHover || anyFine)) return 'hybrid'; // workaround for browsers that have the touch events api,
  // and have implemented Level 4 media queries but not the
  // hover and pointer media queries, so the tests are all false (notable Firefox)
  // if it hasTouch, no pointer and hover support, and on an android assume it's touchOnly
  // if it hasTouch, no pointer and hover support, and not on an android assume it's a hybrid

  if (hasTouch && Object.keys(state.detectHover).filter(function (key) {
    return key !== 'update';
  }).every(function (key) {
    return state.detectHover[key] === false;
  }) && Object.keys(state.detectPointer).filter(function (key) {
    return key !== 'update';
  }).every(function (key) {
    return state.detectPointer[key] === false;
  })) {
    if (window.navigator && /android/.test(window.navigator.userAgent.toLowerCase())) {
      return 'touchOnly';
    }

    return 'hybrid';
  } // In almost all cases a device that doesn’t support touch will have a mouse,
  // but there may be rare exceptions. Note that it doesn’t work to do additional tests
  // based on hover and pointer media queries as older browsers don’t support these.
  // Essentially, 'mouseOnly' is the default.


  return hasTouch ? 'touchOnly' : 'mouseOnly';
}

var detectIt = {
  state: {
    detectHover: _detectHover.default,
    detectPointer: _detectPointer.default,
    detectTouchEvents: _detectTouchEvents.default,
    detectPassiveEvents: _detectPassiveEvents.default
  },
  update: function update() {
    detectIt.state.detectHover.update();
    detectIt.state.detectPointer.update();
    detectIt.state.detectTouchEvents.update();
    detectIt.state.detectPassiveEvents.update();
    detectIt.updateOnlyOwnProperties();
  },
  updateOnlyOwnProperties: function updateOnlyOwnProperties() {
    if (typeof window !== 'undefined') {
      detectIt.passiveEvents = detectIt.state.detectPassiveEvents.hasSupport || false;
      detectIt.hasTouch = detectIt.state.detectTouchEvents.hasSupport || false;
      detectIt.deviceType = determineDeviceType(detectIt.hasTouch, detectIt.state.detectHover.anyHover, detectIt.state.detectPointer.anyFine, detectIt.state);
      detectIt.hasMouse = detectIt.deviceType !== 'touchOnly';
      detectIt.primaryInput = detectIt.deviceType === 'mouseOnly' && 'mouse' || detectIt.deviceType === 'touchOnly' && 'touch' || // deviceType is hybrid:
      detectIt.state.detectPointer.fine && 'mouse' || detectIt.state.detectPointer.coarse && 'touch' || // if there's no support for hover media queries but detectIt determined it's
      // a hybrid  device, then assume it's a mouse first device
      'mouse'; // issue with Windows Chrome on hybrid devices starting in version 59 where
      // media queries represent a touch only device, so if the browser is an
      // affected Windows Chrome version and hasTouch,
      // then assume it's a hybrid with primaryInput mouse
      // note that version 62 of Chrome fixes this issue
      // see https://github.com/rafrex/detect-it/issues/8

      var inVersionRange = function inVersionRange(version) {
        return version >= 59 && version < 62;
      };

      var isAffectedWindowsChromeVersion = /windows/.test(window.navigator.userAgent.toLowerCase()) && /chrome/.test(window.navigator.userAgent.toLowerCase()) && inVersionRange(parseInt(/Chrome\/([0-9.]+)/.exec(navigator.userAgent)[1], 10));

      if (isAffectedWindowsChromeVersion && detectIt.hasTouch) {
        detectIt.deviceType = 'hybrid';
        detectIt.hasMouse = true;
        detectIt.primaryInput = 'mouse';
      }
    }
  }
};
detectIt.updateOnlyOwnProperties();
var _default = detectIt;
exports.default = _default;

},{"detect-hover":2,"detect-passive-events":4,"detect-pointer":5,"detect-touch-events":6}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
}); // adapted from https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md

var detectPassiveEvents = {
  update: function update() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      var passive = false;
      var options = Object.defineProperty({}, 'passive', {
        get: function get() {
          passive = true;
        }
      }); // note: have to set and remove a no-op listener instead of null
      // (which was used previously), becasue Edge v15 throws an error
      // when providing a null callback.
      // https://github.com/rafrex/detect-passive-events/pull/3

      var noop = function noop() {};

      window.addEventListener('testPassiveEventSupport', noop, options);
      window.removeEventListener('testPassiveEventSupport', noop, options);
      detectPassiveEvents.hasSupport = passive;
    }
  }
};
detectPassiveEvents.update();
exports.default = detectPassiveEvents;

},{}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var detectPointer = {
  update: function update() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      detectPointer.fine = window.matchMedia('(pointer: fine)').matches;
      detectPointer.coarse = window.matchMedia('(pointer: coarse)').matches;
      detectPointer.none = window.matchMedia('(pointer: none)').matches;
      detectPointer.anyFine = window.matchMedia('(any-pointer: fine)').matches;
      detectPointer.anyCoarse = window.matchMedia('(any-pointer: coarse)').matches;
      detectPointer.anyNone = window.matchMedia('(any-pointer: none)').matches;
    }
  }
};
detectPointer.update();
exports.default = detectPointer;

},{}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var detectTouchEvents = {
  update: function update() {
    if (typeof window !== 'undefined') {
      detectTouchEvents.hasSupport = 'ontouchstart' in window;
      detectTouchEvents.browserSupportsApi = Boolean(window.TouchEvent);
    }
  }
};
detectTouchEvents.update();
exports.default = detectTouchEvents;

},{}],7:[function(require,module,exports){
"use strict";

/*global define:false */

/**
 * Copyright 2012-2017 Craig Campbell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Mousetrap is a simple keyboard shortcut library for Javascript with
 * no external dependencies
 *
 * @version 1.6.3
 * @url craig.is/killing/mice
 */
(function (window, document, undefined) {
  // Check if mousetrap is used inside browser, if not, return
  if (!window) {
    return;
  }
  /**
   * mapping of special keycodes to their corresponding keys
   *
   * everything in this dictionary cannot use keypress events
   * so it has to be here to map to the correct keycodes for
   * keyup/keydown events
   *
   * @type {Object}
   */


  var _MAP = {
    8: 'backspace',
    9: 'tab',
    13: 'enter',
    16: 'shift',
    17: 'ctrl',
    18: 'alt',
    20: 'capslock',
    27: 'esc',
    32: 'space',
    33: 'pageup',
    34: 'pagedown',
    35: 'end',
    36: 'home',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    45: 'ins',
    46: 'del',
    91: 'meta',
    93: 'meta',
    224: 'meta'
  };
  /**
   * mapping for special characters so they can support
   *
   * this dictionary is only used incase you want to bind a
   * keyup or keydown event to one of these keys
   *
   * @type {Object}
   */

  var _KEYCODE_MAP = {
    106: '*',
    107: '+',
    109: '-',
    110: '.',
    111: '/',
    186: ';',
    187: '=',
    188: ',',
    189: '-',
    190: '.',
    191: '/',
    192: '`',
    219: '[',
    220: '\\',
    221: ']',
    222: '\''
  };
  /**
   * this is a mapping of keys that require shift on a US keypad
   * back to the non shift equivelents
   *
   * this is so you can use keyup events with these keys
   *
   * note that this will only work reliably on US keyboards
   *
   * @type {Object}
   */

  var _SHIFT_MAP = {
    '~': '`',
    '!': '1',
    '@': '2',
    '#': '3',
    '$': '4',
    '%': '5',
    '^': '6',
    '&': '7',
    '*': '8',
    '(': '9',
    ')': '0',
    '_': '-',
    '+': '=',
    ':': ';',
    '\"': '\'',
    '<': ',',
    '>': '.',
    '?': '/',
    '|': '\\'
  };
  /**
   * this is a list of special strings you can use to map
   * to modifier keys when you specify your keyboard shortcuts
   *
   * @type {Object}
   */

  var _SPECIAL_ALIASES = {
    'option': 'alt',
    'command': 'meta',
    'return': 'enter',
    'escape': 'esc',
    'plus': '+',
    'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
  };
  /**
   * variable to store the flipped version of _MAP from above
   * needed to check if we should use keypress or not when no action
   * is specified
   *
   * @type {Object|undefined}
   */

  var _REVERSE_MAP;
  /**
   * loop through the f keys, f1 to f19 and add them to the map
   * programatically
   */


  for (var i = 1; i < 20; ++i) {
    _MAP[111 + i] = 'f' + i;
  }
  /**
   * loop through to map numbers on the numeric keypad
   */


  for (i = 0; i <= 9; ++i) {
    // This needs to use a string cause otherwise since 0 is falsey
    // mousetrap will never fire for numpad 0 pressed as part of a keydown
    // event.
    //
    // @see https://github.com/ccampbell/mousetrap/pull/258
    _MAP[i + 96] = i.toString();
  }
  /**
   * cross browser add event method
   *
   * @param {Element|HTMLDocument} object
   * @param {string} type
   * @param {Function} callback
   * @returns void
   */


  function _addEvent(object, type, callback) {
    if (object.addEventListener) {
      object.addEventListener(type, callback, false);
      return;
    }

    object.attachEvent('on' + type, callback);
  }
  /**
   * takes the event and returns the key character
   *
   * @param {Event} e
   * @return {string}
   */


  function _characterFromEvent(e) {
    // for keypress events we should return the character as is
    if (e.type == 'keypress') {
      var character = String.fromCharCode(e.which); // if the shift key is not pressed then it is safe to assume
      // that we want the character to be lowercase.  this means if
      // you accidentally have caps lock on then your key bindings
      // will continue to work
      //
      // the only side effect that might not be desired is if you
      // bind something like 'A' cause you want to trigger an
      // event when capital A is pressed caps lock will no longer
      // trigger the event.  shift+a will though.

      if (!e.shiftKey) {
        character = character.toLowerCase();
      }

      return character;
    } // for non keypress events the special maps are needed


    if (_MAP[e.which]) {
      return _MAP[e.which];
    }

    if (_KEYCODE_MAP[e.which]) {
      return _KEYCODE_MAP[e.which];
    } // if it is not in the special map
    // with keydown and keyup events the character seems to always
    // come in as an uppercase character whether you are pressing shift
    // or not.  we should make sure it is always lowercase for comparisons


    return String.fromCharCode(e.which).toLowerCase();
  }
  /**
   * checks if two arrays are equal
   *
   * @param {Array} modifiers1
   * @param {Array} modifiers2
   * @returns {boolean}
   */


  function _modifiersMatch(modifiers1, modifiers2) {
    return modifiers1.sort().join(',') === modifiers2.sort().join(',');
  }
  /**
   * takes a key event and figures out what the modifiers are
   *
   * @param {Event} e
   * @returns {Array}
   */


  function _eventModifiers(e) {
    var modifiers = [];

    if (e.shiftKey) {
      modifiers.push('shift');
    }

    if (e.altKey) {
      modifiers.push('alt');
    }

    if (e.ctrlKey) {
      modifiers.push('ctrl');
    }

    if (e.metaKey) {
      modifiers.push('meta');
    }

    return modifiers;
  }
  /**
   * prevents default for this event
   *
   * @param {Event} e
   * @returns void
   */


  function _preventDefault(e) {
    if (e.preventDefault) {
      e.preventDefault();
      return;
    }

    e.returnValue = false;
  }
  /**
   * stops propogation for this event
   *
   * @param {Event} e
   * @returns void
   */


  function _stopPropagation(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
      return;
    }

    e.cancelBubble = true;
  }
  /**
   * determines if the keycode specified is a modifier key or not
   *
   * @param {string} key
   * @returns {boolean}
   */


  function _isModifier(key) {
    return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
  }
  /**
   * reverses the map lookup so that we can look for specific keys
   * to see what can and can't use keypress
   *
   * @return {Object}
   */


  function _getReverseMap() {
    if (!_REVERSE_MAP) {
      _REVERSE_MAP = {};

      for (var key in _MAP) {
        // pull out the numeric keypad from here cause keypress should
        // be able to detect the keys from the character
        if (key > 95 && key < 112) {
          continue;
        }

        if (_MAP.hasOwnProperty(key)) {
          _REVERSE_MAP[_MAP[key]] = key;
        }
      }
    }

    return _REVERSE_MAP;
  }
  /**
   * picks the best action based on the key combination
   *
   * @param {string} key - character for key
   * @param {Array} modifiers
   * @param {string=} action passed in
   */


  function _pickBestAction(key, modifiers, action) {
    // if no action was picked in we should try to pick the one
    // that we think would work best for this key
    if (!action) {
      action = _getReverseMap()[key] ? 'keydown' : 'keypress';
    } // modifier keys don't work as expected with keypress,
    // switch to keydown


    if (action == 'keypress' && modifiers.length) {
      action = 'keydown';
    }

    return action;
  }
  /**
   * Converts from a string key combination to an array
   *
   * @param  {string} combination like "command+shift+l"
   * @return {Array}
   */


  function _keysFromString(combination) {
    if (combination === '+') {
      return ['+'];
    }

    combination = combination.replace(/\+{2}/g, '+plus');
    return combination.split('+');
  }
  /**
   * Gets info for a specific key combination
   *
   * @param  {string} combination key combination ("command+s" or "a" or "*")
   * @param  {string=} action
   * @returns {Object}
   */


  function _getKeyInfo(combination, action) {
    var keys;
    var key;
    var i;
    var modifiers = []; // take the keys from this pattern and figure out what the actual
    // pattern is all about

    keys = _keysFromString(combination);

    for (i = 0; i < keys.length; ++i) {
      key = keys[i]; // normalize key names

      if (_SPECIAL_ALIASES[key]) {
        key = _SPECIAL_ALIASES[key];
      } // if this is not a keypress event then we should
      // be smart about using shift keys
      // this will only work for US keyboards however


      if (action && action != 'keypress' && _SHIFT_MAP[key]) {
        key = _SHIFT_MAP[key];
        modifiers.push('shift');
      } // if this key is a modifier then add it to the list of modifiers


      if (_isModifier(key)) {
        modifiers.push(key);
      }
    } // depending on what the key combination is
    // we will try to pick the best event for it


    action = _pickBestAction(key, modifiers, action);
    return {
      key: key,
      modifiers: modifiers,
      action: action
    };
  }

  function _belongsTo(element, ancestor) {
    if (element === null || element === document) {
      return false;
    }

    if (element === ancestor) {
      return true;
    }

    return _belongsTo(element.parentNode, ancestor);
  }

  function Mousetrap(targetElement) {
    var self = this;
    targetElement = targetElement || document;

    if (!(self instanceof Mousetrap)) {
      return new Mousetrap(targetElement);
    }
    /**
     * element to attach key events to
     *
     * @type {Element}
     */


    self.target = targetElement;
    /**
     * a list of all the callbacks setup via Mousetrap.bind()
     *
     * @type {Object}
     */

    self._callbacks = {};
    /**
     * direct map of string combinations to callbacks used for trigger()
     *
     * @type {Object}
     */

    self._directMap = {};
    /**
     * keeps track of what level each sequence is at since multiple
     * sequences can start out with the same sequence
     *
     * @type {Object}
     */

    var _sequenceLevels = {};
    /**
     * variable to store the setTimeout call
     *
     * @type {null|number}
     */

    var _resetTimer;
    /**
     * temporary state where we will ignore the next keyup
     *
     * @type {boolean|string}
     */


    var _ignoreNextKeyup = false;
    /**
     * temporary state where we will ignore the next keypress
     *
     * @type {boolean}
     */

    var _ignoreNextKeypress = false;
    /**
     * are we currently inside of a sequence?
     * type of action ("keyup" or "keydown" or "keypress") or false
     *
     * @type {boolean|string}
     */

    var _nextExpectedAction = false;
    /**
     * resets all sequence counters except for the ones passed in
     *
     * @param {Object} doNotReset
     * @returns void
     */

    function _resetSequences(doNotReset) {
      doNotReset = doNotReset || {};
      var activeSequences = false,
          key;

      for (key in _sequenceLevels) {
        if (doNotReset[key]) {
          activeSequences = true;
          continue;
        }

        _sequenceLevels[key] = 0;
      }

      if (!activeSequences) {
        _nextExpectedAction = false;
      }
    }
    /**
     * finds all callbacks that match based on the keycode, modifiers,
     * and action
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event|Object} e
     * @param {string=} sequenceName - name of the sequence we are looking for
     * @param {string=} combination
     * @param {number=} level
     * @returns {Array}
     */


    function _getMatches(character, modifiers, e, sequenceName, combination, level) {
      var i;
      var callback;
      var matches = [];
      var action = e.type; // if there are no events related to this keycode

      if (!self._callbacks[character]) {
        return [];
      } // if a modifier key is coming up on its own we should allow it


      if (action == 'keyup' && _isModifier(character)) {
        modifiers = [character];
      } // loop through all callbacks for the key that was pressed
      // and see if any of them match


      for (i = 0; i < self._callbacks[character].length; ++i) {
        callback = self._callbacks[character][i]; // if a sequence name is not specified, but this is a sequence at
        // the wrong level then move onto the next match

        if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
          continue;
        } // if the action we are looking for doesn't match the action we got
        // then we should keep going


        if (action != callback.action) {
          continue;
        } // if this is a keypress event and the meta key and control key
        // are not pressed that means that we need to only look at the
        // character, otherwise check the modifiers as well
        //
        // chrome will not fire a keypress if meta or control is down
        // safari will fire a keypress if meta or meta+shift is down
        // firefox will fire a keypress if meta or control is down


        if (action == 'keypress' && !e.metaKey && !e.ctrlKey || _modifiersMatch(modifiers, callback.modifiers)) {
          // when you bind a combination or sequence a second time it
          // should overwrite the first one.  if a sequenceName or
          // combination is specified in this call it does just that
          //
          // @todo make deleting its own method?
          var deleteCombo = !sequenceName && callback.combo == combination;
          var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;

          if (deleteCombo || deleteSequence) {
            self._callbacks[character].splice(i, 1);
          }

          matches.push(callback);
        }
      }

      return matches;
    }
    /**
     * actually calls the callback function
     *
     * if your callback function returns false this will use the jquery
     * convention - prevent default and stop propogation on the event
     *
     * @param {Function} callback
     * @param {Event} e
     * @returns void
     */


    function _fireCallback(callback, e, combo, sequence) {
      // if this event should not happen stop here
      if (self.stopCallback(e, e.target || e.srcElement, combo, sequence)) {
        return;
      }

      if (callback(e, combo) === false) {
        _preventDefault(e);

        _stopPropagation(e);
      }
    }
    /**
     * handles a character key event
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event} e
     * @returns void
     */


    self._handleKey = function (character, modifiers, e) {
      var callbacks = _getMatches(character, modifiers, e);

      var i;
      var doNotReset = {};
      var maxLevel = 0;
      var processedSequenceCallback = false; // Calculate the maxLevel for sequences so we can only execute the longest callback sequence

      for (i = 0; i < callbacks.length; ++i) {
        if (callbacks[i].seq) {
          maxLevel = Math.max(maxLevel, callbacks[i].level);
        }
      } // loop through matching callbacks for this key event


      for (i = 0; i < callbacks.length; ++i) {
        // fire for all sequence callbacks
        // this is because if for example you have multiple sequences
        // bound such as "g i" and "g t" they both need to fire the
        // callback for matching g cause otherwise you can only ever
        // match the first one
        if (callbacks[i].seq) {
          // only fire callbacks for the maxLevel to prevent
          // subsequences from also firing
          //
          // for example 'a option b' should not cause 'option b' to fire
          // even though 'option b' is part of the other sequence
          //
          // any sequences that do not match here will be discarded
          // below by the _resetSequences call
          if (callbacks[i].level != maxLevel) {
            continue;
          }

          processedSequenceCallback = true; // keep a list of which sequences were matches for later

          doNotReset[callbacks[i].seq] = 1;

          _fireCallback(callbacks[i].callback, e, callbacks[i].combo, callbacks[i].seq);

          continue;
        } // if there were no sequence matches but we are still here
        // that means this is a regular match so we should fire that


        if (!processedSequenceCallback) {
          _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
        }
      } // if the key you pressed matches the type of sequence without
      // being a modifier (ie "keyup" or "keypress") then we should
      // reset all sequences that were not matched by this event
      //
      // this is so, for example, if you have the sequence "h a t" and you
      // type "h e a r t" it does not match.  in this case the "e" will
      // cause the sequence to reset
      //
      // modifier keys are ignored because you can have a sequence
      // that contains modifiers such as "enter ctrl+space" and in most
      // cases the modifier key will be pressed before the next key
      //
      // also if you have a sequence such as "ctrl+b a" then pressing the
      // "b" key will trigger a "keypress" and a "keydown"
      //
      // the "keydown" is expected when there is a modifier, but the
      // "keypress" ends up matching the _nextExpectedAction since it occurs
      // after and that causes the sequence to reset
      //
      // we ignore keypresses in a sequence that directly follow a keydown
      // for the same character


      var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;

      if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
        _resetSequences(doNotReset);
      }

      _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
    };
    /**
     * handles a keydown event
     *
     * @param {Event} e
     * @returns void
     */


    function _handleKeyEvent(e) {
      // normalize e.which for key events
      // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
      if (typeof e.which !== 'number') {
        e.which = e.keyCode;
      }

      var character = _characterFromEvent(e); // no character found then stop


      if (!character) {
        return;
      } // need to use === for the character check because the character can be 0


      if (e.type == 'keyup' && _ignoreNextKeyup === character) {
        _ignoreNextKeyup = false;
        return;
      }

      self.handleKey(character, _eventModifiers(e), e);
    }
    /**
     * called to set a 1 second timeout on the specified sequence
     *
     * this is so after each key press in the sequence you have 1 second
     * to press the next key before you have to start over
     *
     * @returns void
     */


    function _resetSequenceTimer() {
      clearTimeout(_resetTimer);
      _resetTimer = setTimeout(_resetSequences, 1000);
    }
    /**
     * binds a key sequence to an event
     *
     * @param {string} combo - combo specified in bind call
     * @param {Array} keys
     * @param {Function} callback
     * @param {string=} action
     * @returns void
     */


    function _bindSequence(combo, keys, callback, action) {
      // start off by adding a sequence level record for this combination
      // and setting the level to 0
      _sequenceLevels[combo] = 0;
      /**
       * callback to increase the sequence level for this sequence and reset
       * all other sequences that were active
       *
       * @param {string} nextAction
       * @returns {Function}
       */

      function _increaseSequence(nextAction) {
        return function () {
          _nextExpectedAction = nextAction;
          ++_sequenceLevels[combo];

          _resetSequenceTimer();
        };
      }
      /**
       * wraps the specified callback inside of another function in order
       * to reset all sequence counters as soon as this sequence is done
       *
       * @param {Event} e
       * @returns void
       */


      function _callbackAndReset(e) {
        _fireCallback(callback, e, combo); // we should ignore the next key up if the action is key down
        // or keypress.  this is so if you finish a sequence and
        // release the key the final key will not trigger a keyup


        if (action !== 'keyup') {
          _ignoreNextKeyup = _characterFromEvent(e);
        } // weird race condition if a sequence ends with the key
        // another sequence begins with


        setTimeout(_resetSequences, 10);
      } // loop through keys one at a time and bind the appropriate callback
      // function.  for any key leading up to the final one it should
      // increase the sequence. after the final, it should reset all sequences
      //
      // if an action is specified in the original bind call then that will
      // be used throughout.  otherwise we will pass the action that the
      // next key in the sequence should match.  this allows a sequence
      // to mix and match keypress and keydown events depending on which
      // ones are better suited to the key provided


      for (var i = 0; i < keys.length; ++i) {
        var isFinal = i + 1 === keys.length;
        var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);

        _bindSingle(keys[i], wrappedCallback, action, combo, i);
      }
    }
    /**
     * binds a single keyboard combination
     *
     * @param {string} combination
     * @param {Function} callback
     * @param {string=} action
     * @param {string=} sequenceName - name of sequence if part of sequence
     * @param {number=} level - what part of the sequence the command is
     * @returns void
     */


    function _bindSingle(combination, callback, action, sequenceName, level) {
      // store a direct mapped reference for use with Mousetrap.trigger
      self._directMap[combination + ':' + action] = callback; // make sure multiple spaces in a row become a single space

      combination = combination.replace(/\s+/g, ' ');
      var sequence = combination.split(' ');
      var info; // if this pattern is a sequence of keys then run through this method
      // to reprocess each pattern one key at a time

      if (sequence.length > 1) {
        _bindSequence(combination, sequence, callback, action);

        return;
      }

      info = _getKeyInfo(combination, action); // make sure to initialize array if this is the first time
      // a callback is added for this key

      self._callbacks[info.key] = self._callbacks[info.key] || []; // remove an existing match if there is one

      _getMatches(info.key, info.modifiers, {
        type: info.action
      }, sequenceName, combination, level); // add this call back to the array
      // if it is a sequence put it at the beginning
      // if not put it at the end
      //
      // this is important because the way these are processed expects
      // the sequence ones to come first


      self._callbacks[info.key][sequenceName ? 'unshift' : 'push']({
        callback: callback,
        modifiers: info.modifiers,
        action: info.action,
        seq: sequenceName,
        level: level,
        combo: combination
      });
    }
    /**
     * binds multiple combinations to the same callback
     *
     * @param {Array} combinations
     * @param {Function} callback
     * @param {string|undefined} action
     * @returns void
     */


    self._bindMultiple = function (combinations, callback, action) {
      for (var i = 0; i < combinations.length; ++i) {
        _bindSingle(combinations[i], callback, action);
      }
    }; // start!


    _addEvent(targetElement, 'keypress', _handleKeyEvent);

    _addEvent(targetElement, 'keydown', _handleKeyEvent);

    _addEvent(targetElement, 'keyup', _handleKeyEvent);
  }
  /**
   * binds an event to mousetrap
   *
   * can be a single key, a combination of keys separated with +,
   * an array of keys, or a sequence of keys separated by spaces
   *
   * be sure to list the modifier keys first to make sure that the
   * correct key ends up getting bound (the last key in the pattern)
   *
   * @param {string|Array} keys
   * @param {Function} callback
   * @param {string=} action - 'keypress', 'keydown', or 'keyup'
   * @returns void
   */


  Mousetrap.prototype.bind = function (keys, callback, action) {
    var self = this;
    keys = keys instanceof Array ? keys : [keys];

    self._bindMultiple.call(self, keys, callback, action);

    return self;
  };
  /**
   * unbinds an event to mousetrap
   *
   * the unbinding sets the callback function of the specified key combo
   * to an empty function and deletes the corresponding key in the
   * _directMap dict.
   *
   * TODO: actually remove this from the _callbacks dictionary instead
   * of binding an empty function
   *
   * the keycombo+action has to be exactly the same as
   * it was defined in the bind method
   *
   * @param {string|Array} keys
   * @param {string} action
   * @returns void
   */


  Mousetrap.prototype.unbind = function (keys, action) {
    var self = this;
    return self.bind.call(self, keys, function () {}, action);
  };
  /**
   * triggers an event that has already been bound
   *
   * @param {string} keys
   * @param {string=} action
   * @returns void
   */


  Mousetrap.prototype.trigger = function (keys, action) {
    var self = this;

    if (self._directMap[keys + ':' + action]) {
      self._directMap[keys + ':' + action]({}, keys);
    }

    return self;
  };
  /**
   * resets the library back to its initial state.  this is useful
   * if you want to clear out the current keyboard shortcuts and bind
   * new ones - for example if you switch to another page
   *
   * @returns void
   */


  Mousetrap.prototype.reset = function () {
    var self = this;
    self._callbacks = {};
    self._directMap = {};
    return self;
  };
  /**
   * should we stop this event before firing off callbacks
   *
   * @param {Event} e
   * @param {Element} element
   * @return {boolean}
   */


  Mousetrap.prototype.stopCallback = function (e, element) {
    var self = this; // if the element has the class "mousetrap" then no need to stop

    if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
      return false;
    }

    if (_belongsTo(element, self.target)) {
      return false;
    } // Events originating from a shadow DOM are re-targetted and `e.target` is the shadow host,
    // not the initial event target in the shadow tree. Note that not all events cross the
    // shadow boundary.
    // For shadow trees with `mode: 'open'`, the initial event target is the first element in
    // the event’s composed path. For shadow trees with `mode: 'closed'`, the initial event
    // target cannot be obtained.


    if ('composedPath' in e && typeof e.composedPath === 'function') {
      // For open shadow trees, update `element` so that the following check works.
      var initialEventTarget = e.composedPath()[0];

      if (initialEventTarget !== e.target) {
        element = initialEventTarget;
      }
    } // stop for input, select, and textarea


    return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || element.isContentEditable;
  };
  /**
   * exposes _handleKey publicly so it can be overwritten by extensions
   */


  Mousetrap.prototype.handleKey = function () {
    var self = this;
    return self._handleKey.apply(self, arguments);
  };
  /**
   * allow custom key mappings
   */


  Mousetrap.addKeycodes = function (object) {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        _MAP[key] = object[key];
      }
    }

    _REVERSE_MAP = null;
  };
  /**
   * Init the global mousetrap functions
   *
   * This method is needed to allow the global mousetrap functions to work
   * now that mousetrap is a constructor function.
   */


  Mousetrap.init = function () {
    var documentMousetrap = Mousetrap(document);

    for (var method in documentMousetrap) {
      if (method.charAt(0) !== '_') {
        Mousetrap[method] = function (method) {
          return function () {
            return documentMousetrap[method].apply(documentMousetrap, arguments);
          };
        }(method);
      }
    }
  };

  Mousetrap.init(); // expose mousetrap to the global object

  window.Mousetrap = Mousetrap; // expose as a common js module

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mousetrap;
  } // expose mousetrap as an AMD module


  if (typeof define === 'function' && define.amd) {
    define(function () {
      return Mousetrap;
    });
  }
})(typeof window !== 'undefined' ? window : null, typeof window !== 'undefined' ? document : null);

},{}],8:[function(require,module,exports){
"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

(function (global, factory) {
  (typeof exports === "undefined" ? "undefined" : _typeof(exports)) === 'object' && typeof module !== 'undefined' ? factory(exports) : typeof define === 'function' && define.amd ? define(['exports'], factory) : factory(global.pell = {});
})(void 0, function (exports) {
  'use strict';

  var _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  var defaultParagraphSeparatorString = 'defaultParagraphSeparator';
  var formatBlock = 'formatBlock';

  var addEventListener = function addEventListener(parent, type, listener) {
    return parent.addEventListener(type, listener);
  };

  var appendChild = function appendChild(parent, child) {
    return parent.appendChild(child);
  };

  var createElement = function createElement(tag) {
    return document.createElement(tag);
  };

  var queryCommandState = function queryCommandState(command) {
    return document.queryCommandState(command);
  };

  var queryCommandValue = function queryCommandValue(command) {
    return document.queryCommandValue(command);
  };

  var exec = function exec(command) {
    var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    return document.execCommand(command, false, value);
  };

  var defaultActions = {
    bold: {
      icon: '<b>B</b>',
      title: 'Bold',
      state: function state() {
        return queryCommandState('bold');
      },
      result: function result() {
        return exec('bold');
      }
    },
    italic: {
      icon: '<i>I</i>',
      title: 'Italic',
      state: function state() {
        return queryCommandState('italic');
      },
      result: function result() {
        return exec('italic');
      }
    },
    underline: {
      icon: '<u>U</u>',
      title: 'Underline',
      state: function state() {
        return queryCommandState('underline');
      },
      result: function result() {
        return exec('underline');
      }
    },
    strikethrough: {
      icon: '<strike>S</strike>',
      title: 'Strike-through',
      state: function state() {
        return queryCommandState('strikeThrough');
      },
      result: function result() {
        return exec('strikeThrough');
      }
    },
    heading1: {
      icon: '<b>H<sub>1</sub></b>',
      title: 'Heading 1',
      result: function result() {
        return exec(formatBlock, '<h1>');
      }
    },
    heading2: {
      icon: '<b>H<sub>2</sub></b>',
      title: 'Heading 2',
      result: function result() {
        return exec(formatBlock, '<h2>');
      }
    },
    paragraph: {
      icon: '&#182;',
      title: 'Paragraph',
      result: function result() {
        return exec(formatBlock, '<p>');
      }
    },
    quote: {
      icon: '&#8220; &#8221;',
      title: 'Quote',
      result: function result() {
        return exec(formatBlock, '<blockquote>');
      }
    },
    olist: {
      icon: '&#35;',
      title: 'Ordered List',
      result: function result() {
        return exec('insertOrderedList');
      }
    },
    ulist: {
      icon: '&#8226;',
      title: 'Unordered List',
      result: function result() {
        return exec('insertUnorderedList');
      }
    },
    code: {
      icon: '&lt;/&gt;',
      title: 'Code',
      result: function result() {
        return exec(formatBlock, '<pre>');
      }
    },
    line: {
      icon: '&#8213;',
      title: 'Horizontal Line',
      result: function result() {
        return exec('insertHorizontalRule');
      }
    },
    link: {
      icon: '&#128279;',
      title: 'Link',
      result: function result() {
        var url = window.prompt('Enter the link URL');
        if (url) exec('createLink', url);
      }
    },
    image: {
      icon: '&#128247;',
      title: 'Image',
      result: function result() {
        var url = window.prompt('Enter the image URL');
        if (url) exec('insertImage', url);
      }
    }
  };
  var defaultClasses = {
    actionbar: 'pell-actionbar',
    button: 'pell-button',
    content: 'pell-content',
    selected: 'pell-button-selected'
  };

  var init = function init(settings) {
    var actions = settings.actions ? settings.actions.map(function (action) {
      if (typeof action === 'string') return defaultActions[action];else if (defaultActions[action.name]) return _extends({}, defaultActions[action.name], action);
      return action;
    }) : Object.keys(defaultActions).map(function (action) {
      return defaultActions[action];
    });

    var classes = _extends({}, defaultClasses, settings.classes);

    var defaultParagraphSeparator = settings[defaultParagraphSeparatorString] || 'div';
    var actionbar = createElement('div');
    actionbar.className = classes.actionbar;
    appendChild(settings.element, actionbar);
    var content = settings.element.content = createElement('div');
    content.contentEditable = true;
    content.className = classes.content;

    content.oninput = function (_ref) {
      var firstChild = _ref.target.firstChild;
      if (firstChild && firstChild.nodeType === 3) exec(formatBlock, '<' + defaultParagraphSeparator + '>');else if (content.innerHTML === '<br>') content.innerHTML = '';
      settings.onChange(content.innerHTML);
    };

    content.onkeydown = function (event) {
      if (event.key === 'Enter' && queryCommandValue(formatBlock) === 'blockquote') {
        setTimeout(function () {
          return exec(formatBlock, '<' + defaultParagraphSeparator + '>');
        }, 0);
      }
    };

    appendChild(settings.element, content);
    actions.forEach(function (action) {
      var button = createElement('button');
      button.className = classes.button;
      button.innerHTML = action.icon;
      button.title = action.title;
      button.setAttribute('type', 'button');

      button.onclick = function () {
        return action.result() && content.focus();
      };

      if (action.state) {
        var handler = function handler() {
          return button.classList[action.state() ? 'add' : 'remove'](classes.selected);
        };

        addEventListener(content, 'keyup', handler);
        addEventListener(content, 'mouseup', handler);
        addEventListener(button, 'click', handler);
      }

      appendChild(actionbar, button);
    });
    if (settings.styleWithCSS) exec('styleWithCSS');
    exec(defaultParagraphSeparatorString, defaultParagraphSeparator);
    return settings.element;
  };

  var pell = {
    exec: exec,
    init: init
  };
  exports.exec = exec;
  exports.init = init;
  exports['default'] = pell;
  Object.defineProperty(exports, '__esModule', {
    value: true
  });
});

},{}],9:[function(require,module,exports){
(function (global){
"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return factory(root);
    });
  } else if ((typeof exports === "undefined" ? "undefined" : _typeof(exports)) === 'object') {
    module.exports = factory(root);
  } else {
    root.SmoothScroll = factory(root);
  }
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : void 0, function (window) {
  'use strict'; //
  // Default settings
  //

  var defaults = {
    // Selectors
    ignore: '[data-scroll-ignore]',
    header: null,
    topOnEmptyHash: true,
    // Speed & Duration
    speed: 500,
    speedAsDuration: false,
    durationMax: null,
    durationMin: null,
    clip: true,
    offset: 0,
    // Easing
    easing: 'easeInOutCubic',
    customEasing: null,
    // History
    updateURL: true,
    popstate: true,
    // Custom Events
    emitEvents: true
  }; //
  // Utility Methods
  //

  /**
   * Check if browser supports required methods
   * @return {Boolean} Returns true if all required methods are supported
   */

  var supports = function supports() {
    return 'querySelector' in document && 'addEventListener' in window && 'requestAnimationFrame' in window && 'closest' in window.Element.prototype;
  };
  /**
   * Merge two or more objects together.
   * @param   {Object}   objects  The objects to merge together
   * @returns {Object}            Merged values of defaults and options
   */


  var extend = function extend() {
    var merged = {};
    Array.prototype.forEach.call(arguments, function (obj) {
      for (var key in obj) {
        if (!obj.hasOwnProperty(key)) return;
        merged[key] = obj[key];
      }
    });
    return merged;
  };
  /**
   * Check to see if user prefers reduced motion
   * @param  {Object} settings Script settings
   */


  var reduceMotion = function reduceMotion(settings) {
    if ('matchMedia' in window && window.matchMedia('(prefers-reduced-motion)').matches) {
      return true;
    }

    return false;
  };
  /**
   * Get the height of an element.
   * @param  {Node} elem The element to get the height of
   * @return {Number}    The element's height in pixels
   */


  var getHeight = function getHeight(elem) {
    return parseInt(window.getComputedStyle(elem).height, 10);
  };
  /**
   * Decode a URI, with error check
   * @param  {String} hash The URI to decode
   * @return {String}      A decoded URI (or the original string if an error is thrown)
   */


  var decode = function decode(hash) {
    var decoded;

    try {
      decoded = decodeURIComponent(hash);
    } catch (e) {
      decoded = hash;
    }

    return decoded;
  };
  /**
   * Escape special characters for use with querySelector
   * @author Mathias Bynens
   * @link https://github.com/mathiasbynens/CSS.escape
   * @param {String} id The anchor ID to escape
   */


  var escapeCharacters = function escapeCharacters(id) {
    // Remove leading hash
    if (id.charAt(0) === '#') {
      id = id.substr(1);
    }

    var string = String(id);
    var length = string.length;
    var index = -1;
    var codeUnit;
    var result = '';
    var firstCodeUnit = string.charCodeAt(0);

    while (++index < length) {
      codeUnit = string.charCodeAt(index); // Note: there’s no need to special-case astral symbols, surrogate
      // pairs, or lone surrogates.
      // If the character is NULL (U+0000), then throw an
      // `InvalidCharacterError` exception and terminate these steps.

      if (codeUnit === 0x0000) {
        throw new InvalidCharacterError('Invalid character: the input contains U+0000.');
      }

      if ( // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
      // U+007F, […]
      codeUnit >= 0x0001 && codeUnit <= 0x001F || codeUnit == 0x007F || // If the character is the first character and is in the range [0-9]
      // (U+0030 to U+0039), […]
      index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039 || // If the character is the second character and is in the range [0-9]
      // (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
      index === 1 && codeUnit >= 0x0030 && codeUnit <= 0x0039 && firstCodeUnit === 0x002D) {
        // http://dev.w3.org/csswg/cssom/#escape-a-character-as-code-point
        result += '\\' + codeUnit.toString(16) + ' ';
        continue;
      } // If the character is not handled by one of the above rules and is
      // greater than or equal to U+0080, is `-` (U+002D) or `_` (U+005F), or
      // is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to
      // U+005A), or [a-z] (U+0061 to U+007A), […]


      if (codeUnit >= 0x0080 || codeUnit === 0x002D || codeUnit === 0x005F || codeUnit >= 0x0030 && codeUnit <= 0x0039 || codeUnit >= 0x0041 && codeUnit <= 0x005A || codeUnit >= 0x0061 && codeUnit <= 0x007A) {
        // the character itself
        result += string.charAt(index);
        continue;
      } // Otherwise, the escaped character.
      // http://dev.w3.org/csswg/cssom/#escape-a-character


      result += '\\' + string.charAt(index);
    } // Return sanitized hash


    var hash;

    try {
      hash = decodeURIComponent('#' + result);
    } catch (e) {
      hash = '#' + result;
    }

    return hash;
  };
  /**
   * Calculate the easing pattern
   * @link https://gist.github.com/gre/1650294
   * @param {String} type Easing pattern
   * @param {Number} time Time animation should take to complete
   * @returns {Number}
   */


  var easingPattern = function easingPattern(settings, time) {
    var pattern; // Default Easing Patterns

    if (settings.easing === 'easeInQuad') pattern = time * time; // accelerating from zero velocity

    if (settings.easing === 'easeOutQuad') pattern = time * (2 - time); // decelerating to zero velocity

    if (settings.easing === 'easeInOutQuad') pattern = time < 0.5 ? 2 * time * time : -1 + (4 - 2 * time) * time; // acceleration until halfway, then deceleration

    if (settings.easing === 'easeInCubic') pattern = time * time * time; // accelerating from zero velocity

    if (settings.easing === 'easeOutCubic') pattern = --time * time * time + 1; // decelerating to zero velocity

    if (settings.easing === 'easeInOutCubic') pattern = time < 0.5 ? 4 * time * time * time : (time - 1) * (2 * time - 2) * (2 * time - 2) + 1; // acceleration until halfway, then deceleration

    if (settings.easing === 'easeInQuart') pattern = time * time * time * time; // accelerating from zero velocity

    if (settings.easing === 'easeOutQuart') pattern = 1 - --time * time * time * time; // decelerating to zero velocity

    if (settings.easing === 'easeInOutQuart') pattern = time < 0.5 ? 8 * time * time * time * time : 1 - 8 * --time * time * time * time; // acceleration until halfway, then deceleration

    if (settings.easing === 'easeInQuint') pattern = time * time * time * time * time; // accelerating from zero velocity

    if (settings.easing === 'easeOutQuint') pattern = 1 + --time * time * time * time * time; // decelerating to zero velocity

    if (settings.easing === 'easeInOutQuint') pattern = time < 0.5 ? 16 * time * time * time * time * time : 1 + 16 * --time * time * time * time * time; // acceleration until halfway, then deceleration
    // Custom Easing Patterns

    if (!!settings.customEasing) pattern = settings.customEasing(time);
    return pattern || time; // no easing, no acceleration
  };
  /**
   * Determine the document's height
   * @returns {Number}
   */


  var getDocumentHeight = function getDocumentHeight() {
    return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.body.clientHeight, document.documentElement.clientHeight);
  };
  /**
   * Calculate how far to scroll
   * Clip support added by robjtede - https://github.com/cferdinandi/smooth-scroll/issues/405
   * @param {Element} anchor       The anchor element to scroll to
   * @param {Number}  headerHeight Height of a fixed header, if any
   * @param {Number}  offset       Number of pixels by which to offset scroll
   * @param {Boolean} clip         If true, adjust scroll distance to prevent abrupt stops near the bottom of the page
   * @returns {Number}
   */


  var getEndLocation = function getEndLocation(anchor, headerHeight, offset, clip) {
    var location = 0;

    if (anchor.offsetParent) {
      do {
        location += anchor.offsetTop;
        anchor = anchor.offsetParent;
      } while (anchor);
    }

    location = Math.max(location - headerHeight - offset, 0);

    if (clip) {
      location = Math.min(location, getDocumentHeight() - window.innerHeight);
    }

    return location;
  };
  /**
   * Get the height of the fixed header
   * @param  {Node}   header The header
   * @return {Number}        The height of the header
   */


  var getHeaderHeight = function getHeaderHeight(header) {
    return !header ? 0 : getHeight(header) + header.offsetTop;
  };
  /**
   * Calculate the speed to use for the animation
   * @param  {Number} distance The distance to travel
   * @param  {Object} settings The plugin settings
   * @return {Number}          How fast to animate
   */


  var getSpeed = function getSpeed(distance, settings) {
    var speed = settings.speedAsDuration ? settings.speed : Math.abs(distance / 1000 * settings.speed);
    if (settings.durationMax && speed > settings.durationMax) return settings.durationMax;
    if (settings.durationMin && speed < settings.durationMin) return settings.durationMin;
    return speed;
  };
  /**
   * Update the URL
   * @param  {Node}    anchor  The anchor that was scrolled to
   * @param  {Boolean} isNum   If true, anchor is a number
   * @param  {Object}  options Settings for Smooth Scroll
   */


  var updateURL = function updateURL(anchor, isNum, options) {
    // Bail if the anchor is a number
    if (isNum) return; // Verify that pushState is supported and the updateURL option is enabled

    if (!history.pushState || !options.updateURL) return; // Update URL

    history.pushState({
      smoothScroll: JSON.stringify(options),
      anchor: anchor.id
    }, document.title, anchor === document.documentElement ? '#top' : '#' + anchor.id);
  };
  /**
   * Bring the anchored element into focus
   * @param {Node}     anchor      The anchor element
   * @param {Number}   endLocation The end location to scroll to
   * @param {Boolean}  isNum       If true, scroll is to a position rather than an element
   */


  var adjustFocus = function adjustFocus(anchor, endLocation, isNum) {
    // Is scrolling to top of page, blur
    if (anchor === 0) {
      document.body.focus();
    } // Don't run if scrolling to a number on the page


    if (isNum) return; // Otherwise, bring anchor element into focus

    anchor.focus();

    if (document.activeElement !== anchor) {
      anchor.setAttribute('tabindex', '-1');
      anchor.focus();
      anchor.style.outline = 'none';
    }

    window.scrollTo(0, endLocation);
  };
  /**
   * Emit a custom event
   * @param  {String} type    The event type
   * @param  {Object} options The settings object
   * @param  {Node}   anchor  The anchor element
   * @param  {Node}   toggle  The toggle element
   */


  var emitEvent = function emitEvent(type, options, anchor, toggle) {
    if (!options.emitEvents || typeof window.CustomEvent !== 'function') return;
    var event = new CustomEvent(type, {
      bubbles: true,
      detail: {
        anchor: anchor,
        toggle: toggle
      }
    });
    document.dispatchEvent(event);
  }; //
  // SmoothScroll Constructor
  //


  var SmoothScroll = function SmoothScroll(selector, options) {
    //
    // Variables
    //
    var smoothScroll = {}; // Object for public APIs

    var settings, anchor, toggle, fixedHeader, headerHeight, eventTimeout, animationInterval; //
    // Methods
    //

    /**
     * Cancel a scroll-in-progress
     */

    smoothScroll.cancelScroll = function (noEvent) {
      cancelAnimationFrame(animationInterval);
      animationInterval = null;
      if (noEvent) return;
      emitEvent('scrollCancel', settings);
    };
    /**
     * Start/stop the scrolling animation
     * @param {Node|Number} anchor  The element or position to scroll to
     * @param {Element}     toggle  The element that toggled the scroll event
     * @param {Object}      options
     */


    smoothScroll.animateScroll = function (anchor, toggle, options) {
      // Local settings
      var _settings = extend(settings || defaults, options || {}); // Merge user options with defaults
      // Selectors and variables


      var isNum = Object.prototype.toString.call(anchor) === '[object Number]' ? true : false;
      var anchorElem = isNum || !anchor.tagName ? null : anchor;
      if (!isNum && !anchorElem) return;
      var startLocation = window.pageYOffset; // Current location on the page

      if (_settings.header && !fixedHeader) {
        // Get the fixed header if not already set
        fixedHeader = document.querySelector(_settings.header);
      }

      if (!headerHeight) {
        // Get the height of a fixed header if one exists and not already set
        headerHeight = getHeaderHeight(fixedHeader);
      }

      var endLocation = isNum ? anchor : getEndLocation(anchorElem, headerHeight, parseInt(typeof _settings.offset === 'function' ? _settings.offset(anchor, toggle) : _settings.offset, 10), _settings.clip); // Location to scroll to

      var distance = endLocation - startLocation; // distance to travel

      var documentHeight = getDocumentHeight();
      var timeLapsed = 0;
      var speed = getSpeed(distance, _settings);
      var start, percentage, position;
      /**
       * Stop the scroll animation when it reaches its target (or the bottom/top of page)
       * @param {Number} position Current position on the page
       * @param {Number} endLocation Scroll to location
       * @param {Number} animationInterval How much to scroll on this loop
       */

      var stopAnimateScroll = function stopAnimateScroll(position, endLocation) {
        // Get the current location
        var currentLocation = window.pageYOffset; // Check if the end location has been reached yet (or we've hit the end of the document)

        if (position == endLocation || currentLocation == endLocation || (startLocation < endLocation && window.innerHeight + currentLocation) >= documentHeight) {
          // Clear the animation timer
          smoothScroll.cancelScroll(true); // Bring the anchored element into focus

          adjustFocus(anchor, endLocation, isNum); // Emit a custom event

          emitEvent('scrollStop', _settings, anchor, toggle); // Reset start

          start = null;
          animationInterval = null;
          return true;
        }
      };
      /**
       * Loop scrolling animation
       */


      var loopAnimateScroll = function loopAnimateScroll(timestamp) {
        if (!start) {
          start = timestamp;
        }

        timeLapsed += timestamp - start;
        percentage = timeLapsed / parseInt(speed, 10);
        percentage = percentage > 1 ? 1 : percentage;
        position = startLocation + distance * easingPattern(_settings, percentage);
        window.scrollTo(0, Math.floor(position));

        if (!stopAnimateScroll(position, endLocation)) {
          animationInterval = window.requestAnimationFrame(loopAnimateScroll);
          start = timestamp;
        }
      };
      /**
       * Reset position to fix weird iOS bug
       * @link https://github.com/cferdinandi/smooth-scroll/issues/45
       */


      if (window.pageYOffset === 0) {
        window.scrollTo(0, 0);
      } // Update the URL


      updateURL(anchor, isNum, _settings); // Emit a custom event

      emitEvent('scrollStart', _settings, anchor, toggle); // Start scrolling animation

      smoothScroll.cancelScroll(true);
      window.requestAnimationFrame(loopAnimateScroll);
    };
    /**
     * If smooth scroll element clicked, animate scroll
     */


    var clickHandler = function clickHandler(event) {
      // Don't run if the user prefers reduced motion
      if (reduceMotion(settings)) return; // Don't run if right-click or command/control + click

      if (event.button !== 0 || event.metaKey || event.ctrlKey) return; // Check if event.target has closest() method
      // By @totegi - https://github.com/cferdinandi/smooth-scroll/pull/401/

      if (!('closest' in event.target)) return; // Check if a smooth scroll link was clicked

      toggle = event.target.closest(selector);
      if (!toggle || toggle.tagName.toLowerCase() !== 'a' || event.target.closest(settings.ignore)) return; // Only run if link is an anchor and points to the current page

      if (toggle.hostname !== window.location.hostname || toggle.pathname !== window.location.pathname || !/#/.test(toggle.href)) return; // Get an escaped version of the hash

      var hash = escapeCharacters(decode(toggle.hash)); // Get the anchored element

      var anchor = settings.topOnEmptyHash && hash === '#' ? document.documentElement : document.querySelector(hash);
      anchor = !anchor && hash === '#top' ? document.documentElement : anchor; // If anchored element exists, scroll to it

      if (!anchor) return;
      event.preventDefault();
      smoothScroll.animateScroll(anchor, toggle);
    };
    /**
     * Animate scroll on popstate events
     */


    var popstateHandler = function popstateHandler(event) {
      // Stop if history.state doesn't exist (ex. if clicking on a broken anchor link).
      // fixes `Cannot read property 'smoothScroll' of null` error getting thrown.
      if (history.state === null) return; // Only run if state is a popstate record for this instantiation

      if (!history.state.smoothScroll || history.state.smoothScroll !== JSON.stringify(settings)) return; // Only run if state includes an anchor

      if (!history.state.anchor) return; // Get the anchor

      var anchor = document.querySelector(escapeCharacters(decode(history.state.anchor)));
      if (!anchor) return; // Animate scroll to anchor link

      smoothScroll.animateScroll(anchor, null, {
        updateURL: false
      });
    };
    /**
     * On window scroll and resize, only run events at a rate of 15fps for better performance
     */


    var resizeThrottler = function resizeThrottler(event) {
      if (!eventTimeout) {
        eventTimeout = setTimeout(function () {
          eventTimeout = null; // Reset timeout

          headerHeight = getHeaderHeight(fixedHeader); // Get the height of a fixed header if one exists
        }, 66);
      }
    };
    /**
     * Destroy the current initialization.
     */


    smoothScroll.destroy = function () {
      // If plugin isn't already initialized, stop
      if (!settings) return; // Remove event listeners

      document.removeEventListener('click', clickHandler, false);
      window.removeEventListener('resize', resizeThrottler, false);
      window.removeEventListener('popstate', popstateHandler, false); // Cancel any scrolls-in-progress

      smoothScroll.cancelScroll(); // Reset variables

      settings = null;
      anchor = null;
      toggle = null;
      fixedHeader = null;
      headerHeight = null;
      eventTimeout = null;
      animationInterval = null;
    };
    /**
     * Initialize Smooth Scroll
     * @param {Object} options User settings
     */


    smoothScroll.init = function (options) {
      // feature test
      if (!supports()) throw 'Smooth Scroll: This browser does not support the required JavaScript methods and browser APIs.'; // Destroy any existing initializations

      smoothScroll.destroy(); // Selectors and variables

      settings = extend(defaults, options || {}); // Merge user options with defaults

      fixedHeader = settings.header ? document.querySelector(settings.header) : null; // Get the fixed header

      headerHeight = getHeaderHeight(fixedHeader); // When a toggle is clicked, run the click handler

      document.addEventListener('click', clickHandler, false); // If window is resized and there's a fixed header, recalculate its size

      if (fixedHeader) {
        window.addEventListener('resize', resizeThrottler, false);
      } // If updateURL and popState are enabled, listen for pop events


      if (settings.updateURL && settings.popstate) {
        window.addEventListener('popstate', popstateHandler, false);
      }
    }; //
    // Initialize plugin
    //


    smoothScroll.init(options); //
    // Public APIs
    //

    return smoothScroll;
  };

  return SmoothScroll;
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(require,module,exports){
"use strict";

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var defaults = {
  threshold: 50,
  passive: false
};

var Xwiper =
/*#__PURE__*/
function () {
  function Xwiper(element) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, Xwiper);

    this.options = _objectSpread({}, defaults, options);
    this.element = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.onSwipeLeftAgent = null;
    this.onSwipeRightAgent = null;
    this.onSwipeUpAgent = null;
    this.onSwipeDownAgent = null;
    this.onTapAgent = null;
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onSwipeLeft = this.onSwipeLeft.bind(this);
    this.onSwipeRight = this.onSwipeRight.bind(this);
    this.onSwipeUp = this.onSwipeUp.bind(this);
    this.onSwipeDown = this.onSwipeDown.bind(this);
    this.onTap = this.onTap.bind(this);
    this.destroy = this.destroy.bind(this);
    this.handleGesture = this.handleGesture.bind(this);
    var eventOptions = this.options.passive ? {
      passive: true
    } : false;
    this.element = element instanceof EventTarget ? element : document.querySelector(element);
    this.element.addEventListener('touchstart', this.onTouchStart, eventOptions);
    this.element.addEventListener('touchend', this.onTouchEnd, eventOptions);
  }

  _createClass(Xwiper, [{
    key: "onTouchStart",
    value: function onTouchStart(event) {
      this.touchStartX = event.changedTouches[0].screenX;
      this.touchStartY = event.changedTouches[0].screenY;
    }
  }, {
    key: "onTouchEnd",
    value: function onTouchEnd(event) {
      this.touchEndX = event.changedTouches[0].screenX;
      this.touchEndY = event.changedTouches[0].screenY;
      this.handleGesture();
    }
  }, {
    key: "onSwipeLeft",
    value: function onSwipeLeft(func) {
      this.onSwipeLeftAgent = func;
    }
  }, {
    key: "onSwipeRight",
    value: function onSwipeRight(func) {
      this.onSwipeRightAgent = func;
    }
  }, {
    key: "onSwipeUp",
    value: function onSwipeUp(func) {
      this.onSwipeUpAgent = func;
    }
  }, {
    key: "onSwipeDown",
    value: function onSwipeDown(func) {
      this.onSwipeDownAgent = func;
    }
  }, {
    key: "onTap",
    value: function onTap(func) {
      this.onTapAgent = func;
    }
  }, {
    key: "destroy",
    value: function destroy() {
      this.element.removeEventListener('touchstart', this.onTouchStart);
      this.element.removeEventListener('touchend', this.onTouchEnd);
    }
  }, {
    key: "handleGesture",
    value: function handleGesture() {
      /**
       * swiped left
       */
      if (this.touchEndX + this.options.threshold <= this.touchStartX) {
        this.onSwipeLeftAgent && this.onSwipeLeftAgent();
        return 'swiped left';
      }
      /**
       * swiped right
       */


      if (this.touchEndX - this.options.threshold >= this.touchStartX) {
        this.onSwipeRightAgent && this.onSwipeRightAgent();
        return 'swiped right';
      }
      /**
       * swiped up
       */


      if (this.touchEndY + this.options.threshold <= this.touchStartY) {
        this.onSwipeUpAgent && this.onSwipeUpAgent();
        return 'swiped up';
      }
      /**
       * swiped down
       */


      if (this.touchEndY - this.options.threshold >= this.touchStartY) {
        this.onSwipeDownAgent && this.onSwipeDownAgent();
        return 'swiped down';
      }
      /**
       * tap
       */


      if (this.touchEndY === this.touchStartY) {
        this.onTapAgent && this.onTapAgent();
        return 'tap';
      }
    }
  }]);

  return Xwiper;
}();

module.exports = Xwiper;

},{}],11:[function(require,module,exports){
(function (global){
"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// Native Javascript for Bootstrap 4 v2.0.26 | © dnp_theme | MIT-License
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD support:
    define([], factory);
  } else if ((typeof module === "undefined" ? "undefined" : _typeof(module)) === 'object' && module.exports) {
    // CommonJS-like:
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    var bsn = factory();
    root.Carousel = bsn.Carousel;
    root.Modal = bsn.Modal;
  }
})(void 0, function () {
  /* Native Javascript for Bootstrap 4 | Internal Utility Functions
  ----------------------------------------------------------------*/
  "use strict"; // globals

  var globalObject = typeof global !== 'undefined' ? global : this || window,
      DOC = document,
      HTML = DOC.documentElement,
      body = 'body',
      // allow the library to be used in <head>
  // Native Javascript for Bootstrap Global Object
  BSN = globalObject.BSN = {},
      supports = BSN.supports = [],
      // function toggle attributes
  dataToggle = 'data-toggle',
      dataDismiss = 'data-dismiss',
      dataSpy = 'data-spy',
      dataRide = 'data-ride',
      // components
  stringAlert = 'Alert',
      stringButton = 'Button',
      stringCarousel = 'Carousel',
      stringCollapse = 'Collapse',
      stringDropdown = 'Dropdown',
      stringModal = 'Modal',
      stringPopover = 'Popover',
      stringScrollSpy = 'ScrollSpy',
      stringTab = 'Tab',
      stringTooltip = 'Tooltip',
      stringToast = 'Toast',
      // options DATA API
  dataAutohide = 'data-autohide',
      databackdrop = 'data-backdrop',
      dataKeyboard = 'data-keyboard',
      dataTarget = 'data-target',
      dataInterval = 'data-interval',
      dataHeight = 'data-height',
      dataPause = 'data-pause',
      dataTitle = 'data-title',
      dataOriginalTitle = 'data-original-title',
      dataDismissible = 'data-dismissible',
      dataTrigger = 'data-trigger',
      dataAnimation = 'data-animation',
      dataContainer = 'data-container',
      dataPlacement = 'data-placement',
      dataDelay = 'data-delay',
      // option keys
  backdrop = 'backdrop',
      keyboard = 'keyboard',
      delay = 'delay',
      content = 'content',
      target = 'target',
      currentTarget = 'currentTarget',
      interval = 'interval',
      pause = 'pause',
      animation = 'animation',
      placement = 'placement',
      container = 'container',
      // box model
  offsetTop = 'offsetTop',
      offsetBottom = 'offsetBottom',
      offsetLeft = 'offsetLeft',
      scrollTop = 'scrollTop',
      scrollLeft = 'scrollLeft',
      clientWidth = 'clientWidth',
      clientHeight = 'clientHeight',
      offsetWidth = 'offsetWidth',
      offsetHeight = 'offsetHeight',
      innerWidth = 'innerWidth',
      innerHeight = 'innerHeight',
      scrollHeight = 'scrollHeight',
      height = 'height',
      // aria
  ariaExpanded = 'aria-expanded',
      ariaHidden = 'aria-hidden',
      ariaSelected = 'aria-selected',
      // event names
  clickEvent = 'click',
      hoverEvent = 'hover',
      keydownEvent = 'keydown',
      keyupEvent = 'keyup',
      resizeEvent = 'resize',
      scrollEvent = 'scroll',
      // originalEvents
  showEvent = 'show',
      shownEvent = 'shown',
      hideEvent = 'hide',
      hiddenEvent = 'hidden',
      closeEvent = 'close',
      closedEvent = 'closed',
      slidEvent = 'slid',
      slideEvent = 'slide',
      changeEvent = 'change',
      // other
  getAttribute = 'getAttribute',
      setAttribute = 'setAttribute',
      hasAttribute = 'hasAttribute',
      createElement = 'createElement',
      appendChild = 'appendChild',
      innerHTML = 'innerHTML',
      getElementsByTagName = 'getElementsByTagName',
      preventDefault = 'preventDefault',
      getBoundingClientRect = 'getBoundingClientRect',
      querySelectorAll = 'querySelectorAll',
      getElementsByCLASSNAME = 'getElementsByClassName',
      getComputedStyle = 'getComputedStyle',
      indexOf = 'indexOf',
      parentNode = 'parentNode',
      length = 'length',
      toLowerCase = 'toLowerCase',
      Transition = 'Transition',
      Duration = 'Duration',
      Webkit = 'Webkit',
      style = 'style',
      push = 'push',
      tabindex = 'tabindex',
      contains = 'contains',
      active = 'active',
      showClass = 'show',
      collapsing = 'collapsing',
      disabled = 'disabled',
      loading = 'loading',
      left = 'left',
      right = 'right',
      top = 'top',
      bottom = 'bottom',
      // tooltip / popover
  mouseHover = 'onmouseleave' in DOC ? ['mouseenter', 'mouseleave'] : ['mouseover', 'mouseout'],
      tipPositions = /\b(top|bottom|left|right)+/,
      // modal
  modalOverlay = 0,
      fixedTop = 'fixed-top',
      fixedBottom = 'fixed-bottom',
      // transitionEnd since 2.0.4
  supportTransitions = Webkit + Transition in HTML[style] || Transition[toLowerCase]() in HTML[style],
      transitionEndEvent = Webkit + Transition in HTML[style] ? Webkit[toLowerCase]() + Transition + 'End' : Transition[toLowerCase]() + 'end',
      transitionDuration = Webkit + Duration in HTML[style] ? Webkit[toLowerCase]() + Transition + Duration : Transition[toLowerCase]() + Duration,
      // touch since 2.0.26
  touchEvents = {
    start: 'touchstart',
    end: 'touchend',
    move: 'touchmove'
  },
      // set new focus element since 2.0.3
  setFocus = function setFocus(element) {
    element.focus ? element.focus() : element.setActive();
  },
      // class manipulation, since 2.0.0 requires polyfill.js
  addClass = function addClass(element, classNAME) {
    element.classList.add(classNAME);
  },
      removeClass = function removeClass(element, classNAME) {
    element.classList.remove(classNAME);
  },
      hasClass = function hasClass(element, classNAME) {
    // since 2.0.0
    return element.classList[contains](classNAME);
  },
      // selection methods
  getElementsByClassName = function getElementsByClassName(element, classNAME) {
    // returns Array
    return [].slice.call(element[getElementsByCLASSNAME](classNAME));
  },
      queryElement = function queryElement(selector, parent) {
    var lookUp = parent ? parent : DOC;
    return _typeof(selector) === 'object' ? selector : lookUp.querySelector(selector);
  },
      getClosest = function getClosest(element, selector) {
    //element is the element and selector is for the closest parent element to find
    // source http://gomakethings.com/climbing-up-and-down-the-dom-tree-with-vanilla-javascript/
    var firstChar = selector.charAt(0),
        selectorSubstring = selector.substr(1);

    if (firstChar === '.') {
      // If selector is a class
      for (; element && element !== DOC; element = element[parentNode]) {
        // Get closest match
        if (queryElement(selector, element[parentNode]) !== null && hasClass(element, selectorSubstring)) {
          return element;
        }
      }
    } else if (firstChar === '#') {
      // If selector is an ID
      for (; element && element !== DOC; element = element[parentNode]) {
        // Get closest match
        if (element.id === selectorSubstring) {
          return element;
        }
      }
    }

    return false;
  },
      // event attach jQuery style / trigger  since 1.2.0
  on = function on(element, event, handler, options) {
    element.addEventListener(event, handler, options ? options : false);
  },
      off = function off(element, event, handler, options) {
    element.removeEventListener(event, handler, options ? options : false);
  },
      one = function one(element, event, handler) {
    // one since 2.0.4
    on(element, event, function handlerWrapper(e) {
      handler(e);
      off(element, event, handlerWrapper);
    });
  },
      getTransitionDurationFromElement = function getTransitionDurationFromElement(element) {
    var duration = supportTransitions ? globalObject[getComputedStyle](element)[transitionDuration] : 0;
    duration = parseFloat(duration);
    duration = typeof duration === 'number' && !isNaN(duration) ? duration * 1000 : 0;
    return duration; // we take a short offset to make sure we fire on the next frame after animation
  },
      emulateTransitionEnd = function emulateTransitionEnd(element, handler) {
    // emulateTransitionEnd since 2.0.4
    var called = 0,
        duration = getTransitionDurationFromElement(element);
    duration ? one(element, transitionEndEvent, function (e) {
      !called && handler(e), called = 1;
    }) : setTimeout(function () {
      !called && handler(), called = 1;
    }, 17);
  },
      bootstrapCustomEvent = function bootstrapCustomEvent(eventName, componentName, related) {
    var OriginalCustomEvent = new CustomEvent(eventName + '.bs.' + componentName);
    OriginalCustomEvent.relatedTarget = related;
    this.dispatchEvent(OriginalCustomEvent);
  },
      // tooltip / popover stuff
  getScroll = function getScroll() {
    // also Affix and ScrollSpy uses it
    return {
      y: globalObject.pageYOffset || HTML[scrollTop],
      x: globalObject.pageXOffset || HTML[scrollLeft]
    };
  },
      styleTip = function styleTip(link, element, position, parent) {
    // both popovers and tooltips (target,tooltip,placement,elementToAppendTo)
    var elementDimensions = {
      w: element[offsetWidth],
      h: element[offsetHeight]
    },
        windowWidth = HTML[clientWidth] || DOC[body][clientWidth],
        windowHeight = HTML[clientHeight] || DOC[body][clientHeight],
        rect = link[getBoundingClientRect](),
        scroll = parent === DOC[body] ? getScroll() : {
      x: parent[offsetLeft] + parent[scrollLeft],
      y: parent[offsetTop] + parent[scrollTop]
    },
        linkDimensions = {
      w: rect[right] - rect[left],
      h: rect[bottom] - rect[top]
    },
        isPopover = hasClass(element, 'popover'),
        topPosition,
        leftPosition,
        arrow = queryElement('.arrow', element),
        arrowTop,
        arrowLeft,
        arrowWidth,
        arrowHeight,
        halfTopExceed = rect[top] + linkDimensions.h / 2 - elementDimensions.h / 2 < 0,
        halfLeftExceed = rect[left] + linkDimensions.w / 2 - elementDimensions.w / 2 < 0,
        halfRightExceed = rect[left] + elementDimensions.w / 2 + linkDimensions.w / 2 >= windowWidth,
        halfBottomExceed = rect[top] + elementDimensions.h / 2 + linkDimensions.h / 2 >= windowHeight,
        topExceed = rect[top] - elementDimensions.h < 0,
        leftExceed = rect[left] - elementDimensions.w < 0,
        bottomExceed = rect[top] + elementDimensions.h + linkDimensions.h >= windowHeight,
        rightExceed = rect[left] + elementDimensions.w + linkDimensions.w >= windowWidth; // recompute position

    position = (position === left || position === right) && leftExceed && rightExceed ? top : position; // first, when both left and right limits are exceeded, we fall back to top|bottom

    position = position === top && topExceed ? bottom : position;
    position = position === bottom && bottomExceed ? top : position;
    position = position === left && leftExceed ? right : position;
    position = position === right && rightExceed ? left : position; // update tooltip/popover class

    element.className[indexOf](position) === -1 && (element.className = element.className.replace(tipPositions, position)); // we check the computed width & height and update here

    arrowWidth = arrow[offsetWidth];
    arrowHeight = arrow[offsetHeight]; // apply styling to tooltip or popover

    if (position === left || position === right) {
      // secondary|side positions
      if (position === left) {
        // LEFT
        leftPosition = rect[left] + scroll.x - elementDimensions.w - (isPopover ? arrowWidth : 0);
      } else {
        // RIGHT
        leftPosition = rect[left] + scroll.x + linkDimensions.w;
      } // adjust top and arrow


      if (halfTopExceed) {
        topPosition = rect[top] + scroll.y;
        arrowTop = linkDimensions.h / 2 - arrowWidth;
      } else if (halfBottomExceed) {
        topPosition = rect[top] + scroll.y - elementDimensions.h + linkDimensions.h;
        arrowTop = elementDimensions.h - linkDimensions.h / 2 - arrowWidth;
      } else {
        topPosition = rect[top] + scroll.y - elementDimensions.h / 2 + linkDimensions.h / 2;
        arrowTop = elementDimensions.h / 2 - (isPopover ? arrowHeight * 0.9 : arrowHeight / 2);
      }
    } else if (position === top || position === bottom) {
      // primary|vertical positions
      if (position === top) {
        // TOP
        topPosition = rect[top] + scroll.y - elementDimensions.h - (isPopover ? arrowHeight : 0);
      } else {
        // BOTTOM
        topPosition = rect[top] + scroll.y + linkDimensions.h;
      } // adjust left | right and also the arrow


      if (halfLeftExceed) {
        leftPosition = 0;
        arrowLeft = rect[left] + linkDimensions.w / 2 - arrowWidth;
      } else if (halfRightExceed) {
        leftPosition = windowWidth - elementDimensions.w * 1.01;
        arrowLeft = elementDimensions.w - (windowWidth - rect[left]) + linkDimensions.w / 2 - arrowWidth / 2;
      } else {
        leftPosition = rect[left] + scroll.x - elementDimensions.w / 2 + linkDimensions.w / 2;
        arrowLeft = elementDimensions.w / 2 - arrowWidth / 2;
      }
    } // apply style to tooltip/popover and its arrow


    element[style][top] = topPosition + 'px';
    element[style][left] = leftPosition + 'px';
    arrowTop && (arrow[style][top] = arrowTop + 'px');
    arrowLeft && (arrow[style][left] = arrowLeft + 'px');
  };

  BSN.version = '2.0.26';
  /* Native Javascript for Bootstrap 4 | Carousel
  ----------------------------------------------*/
  // CAROUSEL DEFINITION
  // ===================

  var Carousel = function Carousel(element, options) {
    // initialization element
    element = queryElement(element); // set options

    options = options || {}; // DATA API

    var intervalAttribute = element[getAttribute](dataInterval),
        intervalOption = options[interval],
        intervalData = intervalAttribute === 'false' ? 0 : parseInt(intervalAttribute),
        pauseData = element[getAttribute](dataPause) === hoverEvent || false,
        keyboardData = element[getAttribute](dataKeyboard) === 'true' || false,
        // strings
    component = 'carousel',
        paused = 'paused',
        direction = 'direction',
        carouselItem = 'carousel-item',
        dataSlideTo = 'data-slide-to';
    this[keyboard] = options[keyboard] === true || keyboardData;
    this[pause] = options[pause] === hoverEvent || pauseData ? hoverEvent : false; // false / hover

    this[interval] = typeof intervalOption === 'number' ? intervalOption : intervalOption === false || intervalData === 0 || intervalData === false ? 0 : isNaN(intervalData) ? 5000 // bootstrap carousel default interval
    : intervalData; // bind, event targets

    var self = this,
        index = element.index = 0,
        timer = element.timer = 0,
        isSliding = false,
        // isSliding prevents click event handlers when animation is running
    isTouch = false,
        startXPosition = null,
        currentXPosition = null,
        endXPosition = null,
        // touch and event coordinates
    slides = getElementsByClassName(element, carouselItem),
        total = slides[length],
        slideDirection = this[direction] = left,
        leftArrow = getElementsByClassName(element, component + '-control-prev')[0],
        rightArrow = getElementsByClassName(element, component + '-control-next')[0],
        indicator = queryElement('.' + component + '-indicators', element),
        indicators = indicator && indicator[getElementsByTagName]("LI") || []; // invalidate when not enough items

    if (total < 2) {
      return;
    } // handlers


    var pauseHandler = function pauseHandler() {
      if (self[interval] !== false && !hasClass(element, paused)) {
        addClass(element, paused);
        !isSliding && (clearInterval(timer), timer = null);
      }
    },
        resumeHandler = function resumeHandler() {
      if (self[interval] !== false && hasClass(element, paused)) {
        removeClass(element, paused);
        !isSliding && (clearInterval(timer), timer = null);
        !isSliding && self.cycle();
      }
    },
        indicatorHandler = function indicatorHandler(e) {
      e[preventDefault]();
      if (isSliding) return;
      var eventTarget = e[target]; // event target | the current active item

      if (eventTarget && !hasClass(eventTarget, active) && eventTarget[getAttribute](dataSlideTo)) {
        index = parseInt(eventTarget[getAttribute](dataSlideTo), 10);
      } else {
        return false;
      }

      self.slideTo(index); //Do the slide
    },
        controlsHandler = function controlsHandler(e) {
      e[preventDefault]();
      if (isSliding) return;
      var eventTarget = e.currentTarget || e.srcElement;

      if (eventTarget === rightArrow) {
        index++;
      } else if (eventTarget === leftArrow) {
        index--;
      }

      self.slideTo(index); //Do the slide
    },
        keyHandler = function keyHandler(e) {
      if (isSliding) return;

      switch (e.which) {
        case 39:
          index++;
          break;

        case 37:
          index--;
          break;

        default:
          return;
      }

      self.slideTo(index); //Do the slide
    },
        // touch events
    toggleTouchEvents = function toggleTouchEvents(toggle) {
      toggle(element, touchEvents.move, touchMoveHandler, {
        passive: true
      });
      toggle(element, touchEvents.end, touchEndHandler, {
        passive: true
      });
    },
        touchDownHandler = function touchDownHandler(e) {
      if (isTouch) {
        return;
      }

      startXPosition = parseInt(e.touches[0].pageX);

      if (element.contains(e[target])) {
        isTouch = true;
        toggleTouchEvents(on);
      }
    },
        touchMoveHandler = function touchMoveHandler(e) {
      if (!isTouch) {
        e.preventDefault();
        return;
      }

      currentXPosition = parseInt(e.touches[0].pageX); //cancel touch if more than one touches detected

      if (e.type === 'touchmove' && e.touches[length] > 1) {
        e.preventDefault();
        return false;
      }
    },
        touchEndHandler = function touchEndHandler(e) {
      if (!isTouch || isSliding) {
        return;
      }

      endXPosition = currentXPosition || parseInt(e.touches[0].pageX);

      if (isTouch) {
        if ((!element.contains(e[target]) || !element.contains(e.relatedTarget)) && Math.abs(startXPosition - endXPosition) < 75) {
          return false;
        } else {
          if (currentXPosition < startXPosition) {
            index++;
          } else if (currentXPosition > startXPosition) {
            index--;
          }

          isTouch = false;
          self.slideTo(index);
        }

        toggleTouchEvents(off);
      }
    },
        // private methods
    isElementInScrollRange = function isElementInScrollRange() {
      var rect = element[getBoundingClientRect](),
          viewportHeight = globalObject[innerHeight] || HTML[clientHeight];
      return rect[top] <= viewportHeight && rect[bottom] >= 0; // bottom && top
    },
        setActivePage = function setActivePage(pageIndex) {
      //indicators
      for (var i = 0, icl = indicators[length]; i < icl; i++) {
        removeClass(indicators[i], active);
      }

      if (indicators[pageIndex]) addClass(indicators[pageIndex], active);
    }; // public methods


    this.cycle = function () {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      timer = setInterval(function () {
        isElementInScrollRange() && (index++, self.slideTo(index));
      }, this[interval]);
    };

    this.slideTo = function (next) {
      if (isSliding) return; // when controled via methods, make sure to check again      

      var activeItem = this.getActiveIndex(),
          // the current active
      orientation; // first return if we're on the same item #227

      if (activeItem === next) {
        return; // or determine slideDirection
      } else if (activeItem < next || activeItem === 0 && next === total - 1) {
        slideDirection = self[direction] = left; // next
      } else if (activeItem > next || activeItem === total - 1 && next === 0) {
        slideDirection = self[direction] = right; // prev
      } // find the right next index 


      if (next < 0) {
        next = total - 1;
      } else if (next >= total) {
        next = 0;
      } // update index


      index = next;
      orientation = slideDirection === left ? 'next' : 'prev'; //determine type

      bootstrapCustomEvent.call(element, slideEvent, component, slides[next]); // here we go with the slide

      isSliding = true;
      clearInterval(timer);
      timer = null;
      setActivePage(next);

      if (supportTransitions && hasClass(element, 'slide')) {
        addClass(slides[next], carouselItem + '-' + orientation);
        slides[next][offsetWidth];
        addClass(slides[next], carouselItem + '-' + slideDirection);
        addClass(slides[activeItem], carouselItem + '-' + slideDirection);
        emulateTransitionEnd(slides[next], function (e) {
          var timeout = e && e[target] !== slides[next] ? e.elapsedTime * 1000 + 100 : 20;
          isSliding && setTimeout(function () {
            isSliding = false;
            addClass(slides[next], active);
            removeClass(slides[activeItem], active);
            removeClass(slides[next], carouselItem + '-' + orientation);
            removeClass(slides[next], carouselItem + '-' + slideDirection);
            removeClass(slides[activeItem], carouselItem + '-' + slideDirection);
            bootstrapCustomEvent.call(element, slidEvent, component, slides[next]);

            if (!DOC.hidden && self[interval] && !hasClass(element, paused)) {
              self.cycle();
            }
          }, timeout);
        });
      } else {
        addClass(slides[next], active);
        slides[next][offsetWidth];
        removeClass(slides[activeItem], active);
        setTimeout(function () {
          isSliding = false;

          if (self[interval] && !hasClass(element, paused)) {
            self.cycle();
          }

          bootstrapCustomEvent.call(element, slidEvent, component, slides[next]);
        }, 100);
      }
    };

    this.getActiveIndex = function () {
      return slides[indexOf](getElementsByClassName(element, carouselItem + ' active')[0]) || 0;
    }; // init


    if (!(stringCarousel in element)) {
      // prevent adding event handlers twice
      if (self[pause] && self[interval]) {
        on(element, mouseHover[0], pauseHandler, {
          passive: true
        });
        on(element, mouseHover[1], resumeHandler, {
          passive: true
        });
        on(element, touchEvents.start, pauseHandler, {
          passive: true
        });
        on(element, touchEvents.end, resumeHandler, {
          passive: true
        });
      }

      slides[length] > 1 && on(element, touchEvents.start, touchDownHandler, {
        passive: true
      });
      rightArrow && on(rightArrow, clickEvent, controlsHandler);
      leftArrow && on(leftArrow, clickEvent, controlsHandler);
      indicator && on(indicator, clickEvent, indicatorHandler);
      self[keyboard] === true && on(globalObject, keydownEvent, keyHandler);
    }

    if (self.getActiveIndex() < 0) {
      slides[length] && addClass(slides[0], active);
      indicators[length] && setActivePage(0);
    }

    if (self[interval]) {
      self.cycle();
    }

    element[stringCarousel] = self;
  }; // CAROUSEL DATA API
  // =================


  supports[push]([stringCarousel, Carousel, '[' + dataRide + '="carousel"]']);
  /* Native Javascript for Bootstrap 4 | Modal
  -------------------------------------------*/
  // MODAL DEFINITION
  // ===============

  var Modal = function Modal(element, options) {
    // element can be the modal/triggering button
    // the modal (both JavaScript / DATA API init) / triggering button element (DATA API)
    element = queryElement(element); // strings

    var component = 'modal',
        staticString = 'static',
        modalTrigger = 'modalTrigger',
        paddingRight = 'paddingRight',
        modalBackdropString = 'modal-backdrop',
        // determine modal, triggering element
    btnCheck = element[getAttribute](dataTarget) || element[getAttribute]('href'),
        checkModal = queryElement(btnCheck),
        modal = hasClass(element, component) ? element : checkModal;

    if (hasClass(element, component)) {
      element = null;
    } // modal is now independent of it's triggering element


    if (!modal) {
      return;
    } // invalidate
    // set options


    options = options || {};
    this[keyboard] = options[keyboard] === false || modal[getAttribute](dataKeyboard) === 'false' ? false : true;
    this[backdrop] = options[backdrop] === staticString || modal[getAttribute](databackdrop) === staticString ? staticString : true;
    this[backdrop] = options[backdrop] === false || modal[getAttribute](databackdrop) === 'false' ? false : this[backdrop];
    this[content] = options[content]; // JavaScript only
    // bind, constants, event targets and other vars

    var self = this,
        relatedTarget = null,
        bodyIsOverflowing,
        scrollBarWidth,
        overlay,
        overlayDelay,
        // also find fixed-top / fixed-bottom items
    fixedItems = getElementsByClassName(HTML, fixedTop).concat(getElementsByClassName(HTML, fixedBottom)),
        // private methods
    getWindowWidth = function getWindowWidth() {
      var htmlRect = HTML[getBoundingClientRect]();
      return globalObject[innerWidth] || htmlRect[right] - Math.abs(htmlRect[left]);
    },
        setScrollbar = function setScrollbar() {
      var bodyStyle = globalObject[getComputedStyle](DOC[body]),
          bodyPad = parseInt(bodyStyle[paddingRight], 10),
          itemPad;

      if (bodyIsOverflowing) {
        DOC[body][style][paddingRight] = bodyPad + scrollBarWidth + 'px';
        modal[style][paddingRight] = scrollBarWidth + 'px';

        if (fixedItems[length]) {
          for (var i = 0; i < fixedItems[length]; i++) {
            itemPad = globalObject[getComputedStyle](fixedItems[i])[paddingRight];
            fixedItems[i][style][paddingRight] = parseInt(itemPad) + scrollBarWidth + 'px';
          }
        }
      }
    },
        resetScrollbar = function resetScrollbar() {
      DOC[body][style][paddingRight] = '';
      modal[style][paddingRight] = '';

      if (fixedItems[length]) {
        for (var i = 0; i < fixedItems[length]; i++) {
          fixedItems[i][style][paddingRight] = '';
        }
      }
    },
        measureScrollbar = function measureScrollbar() {
      // thx walsh
      var scrollDiv = DOC[createElement]('div'),
          widthValue;
      scrollDiv.className = component + '-scrollbar-measure'; // this is here to stay

      DOC[body][appendChild](scrollDiv);
      widthValue = scrollDiv[offsetWidth] - scrollDiv[clientWidth];
      DOC[body].removeChild(scrollDiv);
      return widthValue;
    },
        checkScrollbar = function checkScrollbar() {
      bodyIsOverflowing = DOC[body][clientWidth] < getWindowWidth();
      scrollBarWidth = measureScrollbar();
    },
        createOverlay = function createOverlay() {
      modalOverlay = 1;
      var newOverlay = DOC[createElement]('div');
      overlay = queryElement('.' + modalBackdropString);

      if (overlay === null) {
        newOverlay[setAttribute]('class', modalBackdropString + ' fade');
        overlay = newOverlay;
        DOC[body][appendChild](overlay);
      }
    },
        removeOverlay = function removeOverlay() {
      overlay = queryElement('.' + modalBackdropString);

      if (overlay && overlay !== null && _typeof(overlay) === 'object') {
        modalOverlay = 0;
        DOC[body].removeChild(overlay);
        overlay = null;
      }

      bootstrapCustomEvent.call(modal, hiddenEvent, component);
    },
        keydownHandlerToggle = function keydownHandlerToggle() {
      if (hasClass(modal, showClass)) {
        on(DOC, keydownEvent, keyHandler);
      } else {
        off(DOC, keydownEvent, keyHandler);
      }
    },
        resizeHandlerToggle = function resizeHandlerToggle() {
      if (hasClass(modal, showClass)) {
        on(globalObject, resizeEvent, self.update);
      } else {
        off(globalObject, resizeEvent, self.update);
      }
    },
        dismissHandlerToggle = function dismissHandlerToggle() {
      if (hasClass(modal, showClass)) {
        on(modal, clickEvent, dismissHandler);
      } else {
        off(modal, clickEvent, dismissHandler);
      }
    },
        // triggers
    triggerShow = function triggerShow() {
      resizeHandlerToggle();
      dismissHandlerToggle();
      keydownHandlerToggle();
      setFocus(modal);
      bootstrapCustomEvent.call(modal, shownEvent, component, relatedTarget);
    },
        triggerHide = function triggerHide() {
      modal[style].display = '';
      element && setFocus(element);

      (function () {
        if (!getElementsByClassName(DOC, component + ' ' + showClass)[0]) {
          resetScrollbar();
          removeClass(DOC[body], component + '-open');
          overlay && hasClass(overlay, 'fade') ? (removeClass(overlay, showClass), emulateTransitionEnd(overlay, removeOverlay)) : removeOverlay();
          resizeHandlerToggle();
          dismissHandlerToggle();
          keydownHandlerToggle();
        }
      })();
    },
        // handlers
    clickHandler = function clickHandler(e) {
      var clickTarget = e[target];
      clickTarget = clickTarget[hasAttribute](dataTarget) || clickTarget[hasAttribute]('href') ? clickTarget : clickTarget[parentNode];

      if (clickTarget === element && !hasClass(modal, showClass)) {
        modal[modalTrigger] = element;
        relatedTarget = element;
        self.show();
        e[preventDefault]();
      }
    },
        keyHandler = function keyHandler(e) {
      if (self[keyboard] && e.which == 27 && hasClass(modal, showClass)) {
        self.hide();
      }
    },
        dismissHandler = function dismissHandler(e) {
      var clickTarget = e[target];

      if (hasClass(modal, showClass) && (clickTarget[parentNode][getAttribute](dataDismiss) === component || clickTarget[getAttribute](dataDismiss) === component || clickTarget === modal && self[backdrop] !== staticString)) {
        self.hide();
        relatedTarget = null;
        e[preventDefault]();
      }
    }; // public methods


    this.toggle = function () {
      if (hasClass(modal, showClass)) {
        this.hide();
      } else {
        this.show();
      }
    };

    this.show = function () {
      bootstrapCustomEvent.call(modal, showEvent, component, relatedTarget); // we elegantly hide any opened modal

      var currentOpen = getElementsByClassName(DOC, component + ' ' + showClass)[0];

      if (currentOpen && currentOpen !== modal) {
        modalTrigger in currentOpen && currentOpen[modalTrigger][stringModal].hide();
        stringModal in currentOpen && currentOpen[stringModal].hide();
      }

      if (this[backdrop]) {
        !modalOverlay && createOverlay();
      }

      if (overlay && modalOverlay && !hasClass(overlay, showClass)) {
        overlay[offsetWidth]; // force reflow to enable trasition

        overlayDelay = getTransitionDurationFromElement(overlay);
        addClass(overlay, showClass);
      }

      setTimeout(function () {
        modal[style].display = 'block';
        checkScrollbar();
        setScrollbar();
        addClass(DOC[body], component + '-open');
        addClass(modal, showClass);
        modal[setAttribute](ariaHidden, false);
        hasClass(modal, 'fade') ? emulateTransitionEnd(modal, triggerShow) : triggerShow();
      }, supportTransitions && overlay ? overlayDelay : 0);
    };

    this.hide = function () {
      bootstrapCustomEvent.call(modal, hideEvent, component);
      overlay = queryElement('.' + modalBackdropString);
      overlayDelay = overlay && getTransitionDurationFromElement(overlay);
      removeClass(modal, showClass);
      modal[setAttribute](ariaHidden, true);
      setTimeout(function () {
        hasClass(modal, 'fade') ? emulateTransitionEnd(modal, triggerHide) : triggerHide();
      }, supportTransitions && overlay ? overlayDelay : 0);
    };

    this.setContent = function (content) {
      queryElement('.' + component + '-content', modal)[innerHTML] = content;
    };

    this.update = function () {
      if (hasClass(modal, showClass)) {
        checkScrollbar();
        setScrollbar();
      }
    }; // init
    // prevent adding event handlers over and over
    // modal is independent of a triggering element


    if (!!element && !(stringModal in element)) {
      on(element, clickEvent, clickHandler);
    }

    if (!!self[content]) {
      self.setContent(self[content]);
    }

    if (element) {
      element[stringModal] = self;
      modal[modalTrigger] = element;
    } else {
      modal[stringModal] = self;
    }
  }; // DATA API


  supports[push]([stringModal, Modal, '[' + dataToggle + '="modal"]']);
  return {
    Carousel: Carousel,
    Modal: Modal
  };
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],12:[function(require,module,exports){
"use strict";

function start() {
  require('./website/controls/lazy-load');

  require('./website/controls/smooth-scroll');

  require('./website/base/partials/javascripts/in-viewport');

  require('./website/controls/audio-player');

  require('./website/controls/carousel-zoom');

  require('./website/controls/carousel-fade');

  require('./website/controls/hover-diagram');

  require('./website/controls/modal-dialog');

  require('./website/controls/pell-editor');

  require('./website/controls/parallax');
}

window.runScripts(start);

},{"./website/base/partials/javascripts/in-viewport":13,"./website/controls/audio-player":17,"./website/controls/carousel-fade":18,"./website/controls/carousel-zoom":19,"./website/controls/hover-diagram":20,"./website/controls/lazy-load":21,"./website/controls/modal-dialog":22,"./website/controls/parallax":23,"./website/controls/pell-editor":24,"./website/controls/smooth-scroll":25}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var defaults = {
  visibilityClass: 'in-viewport',
  enterEventName: 'enter',
  leaveEventName: 'leave',
  observerConfig: {
    root: null,
    rootMargin: '250px',
    threshold: 0
  }
};

var InViewport =
/*#__PURE__*/
function () {
  function InViewport(elements) {
    var _this = this;

    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, InViewport);

    // Plugin options
    this.options = _objectSpread({}, defaults, options); // Track section visibility, without penetrating DOM

    this.visible = new Map(); // Tracked elements

    this.elements = elements; // Intersection Observer instance

    this.observer = new IntersectionObserver(this.handler.bind(this), this.options.observerConfig); // Observe elements

    this.elements.forEach(function (element) {
      return _this.observe(element);
    });
  }

  _createClass(InViewport, [{
    key: "observe",
    value: function observe(element) {
      this.observer.observe(element);
    }
  }, {
    key: "handler",
    value: function handler(entries) {
      var _this2 = this;

      entries.forEach(function (entry) {
        var intersect = entry.isIntersecting;

        var visible = _this2.visible.get(entry.target); // Element enters viewport


        if (intersect && !visible) {
          _this2.visible.set(entry.target, true);

          entry.target.classList.toggle(_this2.options.visibilityClass, true);
          entry.target.dispatchEvent(new CustomEvent(_this2.options.enterEventName));
        } // Element leaves viewport


        if (!intersect && visible) {
          _this2.visible.set(entry.target, false);

          entry.target.classList.toggle(_this2.options.visibilityClass, false);
          entry.target.dispatchEvent(new CustomEvent(_this2.options.leaveEventName));
        }
      });
    }
  }]);

  return InViewport;
}();

exports.default = InViewport;
new InViewport(document.querySelectorAll('section'));

},{}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var defaults = {
  debounce: 50,
  resizeEventName: 'mode-resize',
  passive: true,
  attach: true
};
var modes = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200
};

var ModeResize =
/*#__PURE__*/
function () {
  function ModeResize() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, ModeResize);

    this.options = _objectSpread({}, defaults, options);
    this.resizeHandler = this.handleWindowResize.bind(this);
    if (this.options.attach) this.attach();
  }

  _createClass(ModeResize, [{
    key: "attach",
    value: function attach() {
      window.addEventListener('resize', this.resizeHandler, this.options.passive ? {
        passive: true
      } : false);
    }
  }, {
    key: "detach",
    value: function detach() {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }, {
    key: "handleWindowResize",
    value: function handleWindowResize() {
      var _this = this;

      var handleTimeout = function handleTimeout() {
        var mode = _this.getWindowWidthMode();

        if (mode === 'xs' || mode !== _this.previousMode) {
          _this.previousMode = mode;

          _this.triggerResizeMode(mode);
        }
      };

      clearTimeout(this.timeout);
      this.timeout = setTimeout(handleTimeout, this.options.debounce);
    }
  }, {
    key: "getWindowWidthMode",
    value: function getWindowWidthMode() {
      var result,
          size = window.innerWidth;

      for (var mode in modes) {
        if (size >= modes[mode]) result = mode;else break;
      }

      return result;
    }
  }, {
    key: "triggerResizeMode",
    value: function triggerResizeMode(mode) {
      window.dispatchEvent(new CustomEvent(this.options.resizeEventName, {
        detail: mode
      }));
    }
  }]);

  return ModeResize;
}();

exports.default = ModeResize;

},{}],15:[function(require,module,exports){
'use strict'; // Taken from https://fdossena.com/?p=html5cool/radprog/i.frag

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var RadarProgress =
/*#__PURE__*/
function () {
  function RadarProgress(container, options) {
    var _this = this;

    _classCallCheck(this, RadarProgress);

    this.prevW = 0;
    this.prevH = 0;
    this.prevP = 0;
    this.pause = true; // Default settings

    this.options = {
      colorBg: '#404040',
      colorFg: '#007FFF',
      round: false,
      thick: 2,
      progress: 0,
      animate: true,
      animationSpeed: 1
    };

    if (options) {
      Object.keys(options).forEach(function (key) {
        _this.options[key] = options[key];
      });
    }

    this.options.initialProgress = options.animate ? 0 : this.options.progress;
    this.updateHandler = this.update.bind(this);
    this.init(container);
    this.update();
  }

  _createClass(RadarProgress, [{
    key: "init",
    value: function init(container) {
      var holder = document.createElement('div');
      holder.style.width = '10em';
      holder.style.height = '10em';
      holder.style.position = 'relative';
      var canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      holder.appendChild(canvas);
      container.appendChild(holder);
      this.canvas = canvas;
    }
  }, {
    key: "update",
    value: function update() {
      var canvas = this.canvas;
      var dp = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dp;
      canvas.height = canvas.clientHeight * dp; // Save CPU cycles

      if (this.pause === false && !(this.prevP - this.options.progress < 1 && this.prevW === canvas.width && this.prevH === canvas.height)) {
        this.animate();
      } // Countdown
      else if (this.pause !== true && this.pause !== false && this.pause > 0) {
          this.animate();
          this.pause--;
          if (this.pause === 0) this.pause = true;
        }

      if (this.pause === false) window.requestAnimationFrame(this.updateHandler);
    }
  }, {
    key: "animate",
    value: function animate() {
      // console.log('animate', this.options.animate);
      var canvas = this.canvas;
      var bw = canvas.clientWidth / 100.0,
          dp = window.devicePixelRatio || 1,
          centerX = canvas.width / 2,
          centerY = canvas.height / 2,
          radius = canvas.height / 2 - this.options.thick * bw * dp / 2;

      if (this.options.animate) {
        var aniF = Math.pow(0.93, this.options.animationSpeed);
        this.options.initialProgress = this.options.initialProgress * aniF + this.options.progress * (1 - aniF);
      } else {
        this.options.initialProgress = this.options.progress;
      }

      var context = canvas.getContext('2d');
      if (this.options.round) context.lineCap = 'round';
      context.lineWidth = this.options.thick * bw * dp;
      context.beginPath();
      context.strokeStyle = this.options.colorBg;
      context.arc(centerX, centerY, radius, -Math.PI / 2, 2 * Math.PI);
      context.stroke();
      context.beginPath();
      context.strokeStyle = this.options.colorFg;
      context.arc(centerX, centerY, radius, -1 * Math.PI / 2, this.options.initialProgress * (2 * Math.PI) - Math.PI / 2);
      context.stroke();
      this.prevW = context.width;
      this.prevH = context.height;
      this.prevP = this.options.initialProgress;
    }
  }, {
    key: "attach",
    value: function attach() {
      this.pause = false;
      this.update();
    }
  }, {
    key: "detach",
    value: function detach() {
      this.pause = 5;
    }
  }, {
    key: "setProgress",
    value: function setProgress(p, reset) {
      this.options.progress = p < 0 ? 0 : p > 1 ? 1 : p;
      if (reset) this.options.initialProgress = this.options.progress;
    }
  }]);

  return RadarProgress;
}();

exports.default = RadarProgress;

},{}],16:[function(require,module,exports){
'use strict'; // Taken from https://github.com/dixonandmoe/rellax

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var RellaxParallax =
/*#__PURE__*/
function () {
  function RellaxParallax(el, options) {
    var _this = this;

    _classCallCheck(this, RellaxParallax);

    this.loopId = null;
    this.posY = 0;
    this.posX = 0;
    this.screenY = 0;
    this.screenX = 0;
    this.blocks = [];
    this.pause = true; // Default settings

    this.options = {
      speed: -2,
      wrapper: null,
      round: true,
      vertical: true,
      horizontal: false,
      scroll: false,
      callback: function callback() {}
    }; // User defined options (might have more in the future)

    if (options) {
      Object.keys(options).forEach(function (key) {
        _this.options[key] = options[key];
      });
    } // By default, rellax class


    if (!el) {
      el = '.rellax';
    } // check if el is a className or a node


    var elements = typeof el === 'string' ? document.querySelectorAll(el) : el; // Now query selector

    if (elements.length > 0) {
      this.elems = elements;
    } // The elements don't exist
    else {
        throw new Error('The elements you\'re trying to select don\'t exist.');
      } // Has a wrapper and it exists


    if (this.options.wrapper) {
      if (!this.options.wrapper.nodeType) {
        var wrapper = document.querySelector(this.options.wrapper);

        if (wrapper) {
          this.options.wrapper = wrapper;
        } else {
          throw new Error('The wrapper you\'re trying to use don\'t exist.');
        }
      }
    } // this.initHandler = this.init.bind(this);


    this.updateHandler = this.update.bind(this); // Init

    this.init(); // Start the loop
    // this.update();
  } // Get and cache initial position of all elements


  _createClass(RellaxParallax, [{
    key: "cacheBlocks",
    value: function cacheBlocks() {
      for (var i = 0; i < this.elems.length; i++) {
        var block = this.createBlock(this.elems[i]);
        this.blocks.push(block);
      }
    } // Let's kick this script off
    // Build array for cached element values

  }, {
    key: "init",
    value: function init() {
      if (this.options.wrapper) {
        // Scroll top position
        var scrollPosY = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop; // Remember wrapper offset top

        this.wrapperOffsetTop = this.options.wrapper.getBoundingClientRect().top + scrollPosY; // Remember wrapper height

        this.wrapperOffsetHeight = this.options.wrapper.offsetHeight;
      }

      for (var i = 0; i < this.blocks.length; i++) {
        this.elems[i].style.cssText = this.blocks[i].style;
      }

      this.blocks = [];
      this.screenY = window.innerHeight;
      this.screenX = window.innerWidth;
      this.setPosition();
      this.cacheBlocks(); // Required to make rellax shapes appear without movement on page reload

      this.animate();
    } // We want to cache the parallax blocks'
    // values: base, top, height, speed
    // el: is dom object, return: el cache values

  }, {
    key: "createBlock",
    value: function createBlock(el) {
      var dataMin = el.getAttribute('data-rellax-min');
      var dataMax = el.getAttribute('data-rellax-max');
      var dataSpeed = el.getAttribute('data-rellax-speed');
      var dataZindex = el.getAttribute('data-rellax-zindex') || 0;
      var posY = 0;
      var posX = 0;
      var blockTop = posY + el.getBoundingClientRect().top;
      var blockHeight = el.clientHeight || el.offsetHeight || el.scrollHeight;
      var blockLeft = posX + el.getBoundingClientRect().left;
      var blockWidth = el.clientWidth || el.offsetWidth || el.scrollWidth; // Apparently parallax equation everyone uses

      var percentageY = (posY - blockTop + this.screenY) / (blockHeight + this.screenY);
      var percentageX = (posX - blockLeft + this.screenX) / (blockWidth + this.screenX); // Optional individual block speed as data attr, otherwise global speed

      var speed = dataSpeed ? dataSpeed : this.options.speed;
      var bases = this.updatePosition(percentageX, percentageY, speed); // ~~Store non-translate3d transforms~~
      // Store inline styles and extract transforms

      var style = el.style.cssText;
      var transform = ''; // Check if there's an inline styled transform

      if (style.indexOf('transform') >= 0) {
        // Get the index of the transform
        var index = style.indexOf('transform'); // Trim the style to the transform point and get the following semi-colon index

        var trimmedStyle = style.slice(index);
        var delimiter = trimmedStyle.indexOf(';'); // Remove "transform" string and save the attribute

        if (delimiter) {
          transform = ' ' + trimmedStyle.slice(11, delimiter).replace(/\s/g, '');
        } else {
          transform = ' ' + trimmedStyle.slice(11).replace(/\s/g, '');
        }
      }

      return {
        baseX: bases.x,
        baseY: bases.y,
        top: blockTop,
        left: blockLeft,
        height: blockHeight,
        width: blockWidth,
        speed: speed,
        style: style,
        transform: transform,
        zindex: dataZindex,
        min: dataMin,
        max: dataMax
      };
    } // set scroll position (posY, posX)
    // side effect method is not ideal, but okay for now
    // returns true if the scroll changed, false if nothing happened

  }, {
    key: "setPosition",
    value: function setPosition(scrollY) {
      var oldY = this.posY;
      var oldX = this.posX;
      var scrollPosY = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop;
      this.posY = (scrollY || scrollPosY) + this.screenY / 2 - this.wrapperOffsetTop - this.wrapperOffsetHeight / 2;
      this.posX = this.options.wrapper ? this.options.wrapper.scrollLeft : (document.documentElement || document.body.parentNode || document.body).scrollLeft || window.pageXOffset;

      if (oldY !== this.posY && this.options.vertical) {
        // scroll changed, return true
        return true;
      }

      if (oldX !== this.posX && this.options.horizontal) {
        // scroll changed, return true
        return true;
      } // scroll did not change


      return false;
    } // Ahh a pure function, gets new transform value
    // based on scrollPosition and speed
    // Allow for decimal pixel values

  }, {
    key: "updatePosition",
    value: function updatePosition(percentageX, percentageY, speed) {
      var result = {};
      var valueX = speed * (100 * (1 - percentageX));
      var valueY = speed * (100 * (1 - percentageY));
      result.x = this.options.round ? Math.round(valueX * 1.00) : Math.round(valueX * 100) / 100;
      result.y = this.options.round ? Math.round(valueY * 1.00) : Math.round(valueY * 100) / 100;
      return result;
    } // Loop

  }, {
    key: "update",
    value: function update() {
      if (this.pause === false && this.setPosition()) {
        this.animate();
      }

      if (this.pause === false && !this.options.scroll) this.loopId = window.requestAnimationFrame(this.updateHandler);
    }
  }, {
    key: "refresh",
    value: function refresh(scrollY) {
      this.setPosition(scrollY);
      this.animate();
    } // Transform3d on parallax element

  }, {
    key: "animate",
    value: function animate() {
      var positions;

      for (var i = 0; i < this.elems.length; i++) {
        var percentageY = (this.posY - this.blocks[i].top + this.screenY) / (this.blocks[i].height + this.screenY);
        var percentageX = (this.posX - this.blocks[i].left + this.screenX) / (this.blocks[i].width + this.screenX); // Subtracting initialize value, so element stays in same spot as HTML

        positions = this.updatePosition(percentageX, percentageY, this.blocks[i].speed); // - blocks[i].baseX;

        var positionY = positions.y - this.blocks[i].baseY;
        var positionX = positions.x - this.blocks[i].baseX; // Check if a min limit is defined

        if (this.blocks[i].min !== null) {
          if (this.options.vertical && !this.options.horizontal) {
            positionY = positionY <= this.blocks[i].min ? this.blocks[i].min : positionY;
          }

          if (this.options.horizontal && !this.options.vertical) {
            positionX = positionX <= this.blocks[i].min ? this.blocks[i].min : positionX;
          }
        } // Check if a max limit is defined


        if (this.blocks[i].max !== null) {
          if (this.options.vertical && !this.options.horizontal) {
            positionY = positionY >= this.blocks[i].max ? this.blocks[i].max : positionY;
          }

          if (this.options.horizontal && !this.options.vertical) {
            positionX = positionX >= this.blocks[i].max ? this.blocks[i].max : positionX;
          }
        }

        var zindex = this.blocks[i].zindex; // Move that element
        // (Set the new translation and append initial inline transforms.)

        this.elems[i].style['transform'] = 'translate3d(' + (this.options.horizontal ? positionX : '0') + 'px,' + (this.options.vertical ? positionY : '0') + 'px,' + zindex + 'px) ' + this.blocks[i].transform;
      }

      this.options.callback(positions);
    }
  }, {
    key: "reset",
    value: function reset() {
      for (var i = 0; i < this.blocks.length; i++) {
        this.elems[i].style.cssText = this.blocks[i].style;
      }
    }
  }, {
    key: "attach",
    value: function attach() {
      if (this.pause) {
        if (this.options.scroll) {
          document.addEventListener('scroll', this.updateHandler);
        }

        this.update();
        this.pause = false;
      }
    }
  }, {
    key: "detach",
    value: function detach() {
      if (!this.pause) {
        if (this.options.scroll) {
          document.removeEventListener('scroll', this.updateHandler);
        } else {
          window.cancelAnimationFrame(this.loopId);
          this.loopId = null;
        }

        this.pause = true;
      }
    }
  }]);

  return RellaxParallax;
}();

exports.default = RellaxParallax;

},{}],17:[function(require,module,exports){
"use strict";

var _radarProgress = _interopRequireDefault(require("../base/partials/javascripts/radar-progress"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// 'use strict';
var baseSelector = '[data-plugin=audio-player]';
var baseNode = document.querySelector(baseSelector);

if (baseNode) {
  var html = '<span class="time-label">loading...</span>' + '<span class="play-status"></span>' + '<button class="button-stop" type="button" aria-label="Stop audio"></button>' + '<button class="button-play" type="button" aria-label="Play audio">' + '<span class="radial-border"></span>' + '<span class="radial-progress"></span>' + '<i class="icon icon-player-play"></i>' + '<i class="icon icon-player-pause"></i>' + '</button>';
  baseNode.innerHTML = html;
  var playerNode = baseNode;
  var sectionNode = baseNode.closest('section');
  var progressNode = playerNode.querySelector('.radial-progress');
  var timeLabelNode = playerNode.querySelector('.time-label');
  var playButtonNode = playerNode.querySelector('.button-play');
  var stopButtonNode = playerNode.querySelector('.button-stop');
  var progress = new _radarProgress.default(progressNode, {
    progress: 1 / 360,
    animate: true,
    colorBg: 'rgba(255, 255, 255, 0.25)',
    colorFg: 'rgba(255, 255, 255, 1.00)',
    round: true,
    thick: 4
  });

  var startPlaying = function startPlaying() {
    progress.attach();
    playerNode.classList.toggle('playing', true);
    playerNode.classList.toggle('paused', false);
  };

  var stopPlaying = function stopPlaying() {
    progress.setProgress(1 / 360, true);
    progress.detach();
    playerNode.classList.toggle('playing', false);
    playerNode.classList.toggle('paused', false);
  };

  var pausePlaying = function pausePlaying() {
    progress.detach();
    playerNode.classList.toggle('playing', false);
    playerNode.classList.toggle('paused', true);
  };

  var player = document.createElement('audio');
  player.src = playerNode.getAttribute('href');
  playerNode.appendChild(player);
  player.addEventListener('pause', function () {
    if (player.currentTime > 0) {
      pausePlaying();
    } else {
      stopPlaying();
    }
  });
  player.addEventListener('playing', function () {
    startPlaying();
  }); // player.addEventListener('ended', () => {
  //   console.log('Audio ended', player.currentTime);
  // });
  // let screen = new OnScreen({tolerance: 0, debounce: 5});
  // screen.on('enter', baseSelector, function() {toggleVisible(true);});
  // screen.on('leave', baseSelector, function() {toggleVisible(false);});
  // When player is outside the viewport, we should not update
  // playing time label and radial progress. It causes parallax
  // flickering. Instead, we remember these values in variables
  // and update player controls when it scrolls back into view.

  var visible = null;
  var labelProgress = null;
  var roundProgress = null;

  var toggleVisible = function toggleVisible(value) {
    if (!player.paused) {
      if (value) {
        // If we are reattaching player in a playing state,
        // we should update it with the most recent values,
        // and suppress progress animation.
        if (visible === false) {
          progress.setProgress(roundProgress, true);
          timeLabelNode.innerText = labelProgress;
        }

        progress.attach();
      } else {
        progress.detach();
      }
    }

    visible = value;
  };

  sectionNode.addEventListener('enter', toggleVisible.bind(void 0, true));
  sectionNode.addEventListener('leave', toggleVisible.bind(void 0, false));

  var formatTime = function formatTime(length) {
    var minutes = Math.floor(length / 60),
        seconds = Math.floor(length - minutes * 60),
        minutesPre = minutes < 10 ? '0' + minutes : minutes,
        secondsPre = seconds < 10 ? '0' + seconds : seconds;
    return minutesPre + ':' + secondsPre;
  };

  player.addEventListener('timeupdate', function () {
    labelProgress = formatTime(player.currentTime) + ' / ' + formatTime(player.duration);
    roundProgress = Math.max(1 / 360, player.currentTime / player.duration);

    if (visible) {
      progress.setProgress(roundProgress);
      timeLabelNode.innerText = labelProgress;
    }
  });
  player.addEventListener('ended', function () {
    togglePlaying(true);
  });
  playerNode.addEventListener('click', function (e) {
    e.preventDefault();
  });
  playButtonNode.addEventListener('click', function () {
    togglePlaying();
  });
  stopButtonNode.addEventListener('click', function () {
    togglePlaying(true);
  });
  document.addEventListener('keydown', function (e) {
    if (!window.modalIsOpen && e.code === 'Escape') {
      togglePlaying(true);
    }
  });

  var togglePlaying = function togglePlaying(stop) {
    if (stop) {
      if (player.paused) {
        stopPlaying();
      } else {
        player.pause();
      }

      player.currentTime = 0.0;
    } else {
      if (player.paused === false) {
        player.pause();
      } else {
        player.play();
      }
    }
  };
}

},{"../base/partials/javascripts/radar-progress":15}],18:[function(require,module,exports){
"use strict";

var _bootstrap = _interopRequireDefault(require("../../imports/_bootstrap"));

var _src = _interopRequireDefault(require("xwiper/src"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var baseSelector = '[data-plugin=carousel-fade]';
var baseNode = document.querySelector(baseSelector);

if (baseNode) {
  // Carousel instance
  var carousel = window.carousel = new _bootstrap.default.Carousel(baseNode, {
    interval: 5000
  }); // Attach swipe detection

  var xwiper = new _src.default(baseNode, {
    threshold: 100,
    passive: true
  }); // Swipe gesture handlers

  xwiper.onSwipeLeft(function () {
    carousel.slideTo(carousel.getActiveIndex() + 1);
  });
  xwiper.onSwipeRight(function () {
    carousel.slideTo(carousel.getActiveIndex() - 1);
  });
}

},{"../../imports/_bootstrap":11,"xwiper/src":10}],19:[function(require,module,exports){
"use strict";

var _bootstrap = _interopRequireDefault(require("../../imports/_bootstrap"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var baseSelector = '[data-plugin=carousel-zoom]';
var baseNode = document.querySelector(baseSelector);

if (baseNode) {
  var sectionNode = baseNode.closest('section'); // Auto-slide interval

  var autoSlideInterval = 7500; // Carousel node

  var carouselNode = baseNode; // Carousel inner node

  var carouselInnerNode = carouselNode.querySelector('.carousel-inner'); // Slide nodes

  var slideNodes = carouselInnerNode.querySelectorAll('.carousel-item'); // Block visibility

  var visible = false; // Carousel instance

  var carousel = new _bootstrap.default.Carousel(carouselNode, {
    interval: false
  }); // Screen tracker
  // let screen = new OnScreen({tolerance: 0, debounce: 5});

  sectionNode.addEventListener('enter', function () {
    if (!visible) {
      visible = true;
      window.toggleQuotesCarousel(true);
    }
  });
  sectionNode.addEventListener('leave', function () {
    if (visible) {
      visible = false;
      window.toggleQuotesCarousel(false);
    }
  }); // Updates carousel height to prevent slide jumps
  //

  var updateSlideHeights = function updateSlideHeights() {
    var maxHeight = 0; // Calculate slide heights

    slideNodes.forEach(function (slideNode) {
      // Is this slide active?
      var isActive = slideNode.classList.contains('active'); // Recalculate slide height

      slideNode.classList.toggle('active', true);
      maxHeight = Math.max(maxHeight, slideNode.clientHeight); // slideNode.dataset.height = slideNode.clientHeight;

      slideNode.classList.toggle('active', isActive);
    });
    carouselInnerNode.style.height = maxHeight + 'px';
  }; // let resizeTimer, handleWindowResize = () => {
  //
  //   clearTimeout(resizeTimer);
  //
  //   resizeTimer = setTimeout(function() {
  //     updateSlideHeights();
  //   }, 250);
  //
  // };


  updateSlideHeights();
  window.addEventListener('mode-resize', updateSlideHeights); // Auto-slide function

  var timer,
      timerFunction = function timerFunction() {
    carousel.slideTo(carousel.getActiveIndex() + 1);
  }; // Slides carousel to specified slide


  window.slideToReview = function (id) {
    carousel.slideTo(id);
  }; // Pauses carousel


  window.toggleQuotesCarousel = function (value) {
    clearInterval(timer);

    if (value) {
      carouselNode.style.willChange = 'opacity, transform';
      timer = setInterval(timerFunction, autoSlideInterval);
    } else {
      timer = null;
      carouselNode.style.willChange = '';
    }
  };
}

},{"../../imports/_bootstrap":11}],20:[function(require,module,exports){
"use strict";

var baseSelector = '[data-plugin=hover-diagram]';
var baseNode = document.querySelector(baseSelector);

if (baseNode) {
  var mapping = {
    'xx': ['b1', 'b2', 'b3', 'b4', 'b5', 't1', 't2', 't3', 't4', 't5'],
    'b1': ['b1', 't1', 't3', 't4', 't5'],
    'b2': ['b2', 'b1', 't2', 't3', 't4'],
    'b3': ['b3', 'b1', 't2', 't3', 't4'],
    'b4': ['b4', 'b1', 'b3', 't2', 't4'],
    'b5': ['b5', 'b1', 'b3', 't1', 't2'],
    't1': ['t1', 'b1', 'b3', 'b5'],
    't2': ['t2', 'b2', 'b3', 'b4', 'b5'],
    't3': ['t3', 'b1', 'b3', 'b4'],
    't4': ['t4', 'b1', 'b3', 'b5'],
    't5': ['t5', 'b1', 'b3', 'b5']
  };
  var timeout = null;
  var blockNode = baseNode;
  var cardNodes = Array.prototype.slice.call(blockNode.querySelectorAll('.card'));
  var tickNodes = Array.prototype.slice.call(blockNode.querySelectorAll('.tick'));
  var prevHoverId = null;
  blockNode.addEventListener('mouseover', function (e) {
    if (!e.srcElement.classList.contains('card')) return;
    var hoverElement = e.srcElement;
    var hoverId = hoverElement.dataset.id;
    clearTimeout(timeout);
    var cardMapping = mapping[hoverId];
    var tickMapping = cardMapping.map(function (item) {
      return 'c' + item[1];
    });
    cardNodes.forEach(function (cardNode) {
      cardNode.classList.toggle('check', cardMapping.includes(cardNode.dataset.id));
    });
    tickNodes.forEach(function (tickNode) {
      tickNode.classList.toggle('check', tickMapping.includes(tickNode.dataset.id));
    });
    prevHoverId = hoverId;
  });
  blockNode.addEventListener('mouseout', function (e) {
    if (!e.srcElement.classList.contains('card')) return;
    timeout = setTimeout(function () {
      prevHoverId = null;
      cardNodes.forEach(function (cardNode) {
        cardNode.classList.toggle('check', true);
      });
      tickNodes.forEach(function (tickNode) {
        tickNode.classList.toggle('check', true);
      });
    }, 500);
  });
}

},{}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

// IMPORTANT: Do not use outside <section>
var defaults = {
  loadedClassName: 'loaded',
  loadClassName: 'load',
  passive: true
};

var LazyLoad =
/*#__PURE__*/
function () {
  function LazyLoad(elements) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, LazyLoad);

    this.options = _objectSpread({}, defaults, options);
    this.elements = elements;
    this.map = new Map();
    this.mapSectionsToFlips();
    this.attachOnEnterEvent();
  }

  _createClass(LazyLoad, [{
    key: "mapSectionsToFlips",
    value: function mapSectionsToFlips() {
      var _this = this;

      this.elements.forEach(function (element) {
        var sectionNode = element.closest('section');
        if (!_this.map.has(sectionNode)) _this.map.set(sectionNode, []);

        _this.map.get(sectionNode).push(element);
      });
    }
  }, {
    key: "attachOnEnterEvent",
    value: function attachOnEnterEvent() {
      var _this2 = this;

      this.map.forEach(function (elementNodes, sectionNode) {
        var handler = function handler() {
          sectionNode.removeEventListener('enter', handler);
          elementNodes.forEach(function (elementNode) {
            return _this2.startLoading(elementNode);
          });
        };

        sectionNode.addEventListener('enter', handler, _this2.options.passive ? {
          passive: true
        } : false);
      });
    }
  }, {
    key: "startLoading",
    value: function startLoading(elementNode) {
      var _this3 = this;

      // Lazy-load <picture>
      if (elementNode.tagName === 'PICTURE') {
        var imageNode = elementNode.querySelector('img');
        var flipNodes = elementNode.querySelectorAll('[data-srcset],[data-src]');
        flipNodes.forEach(function (flipNode) {
          if (flipNode.dataset['src']) flipNode.setAttribute('src', flipNode.dataset['src']);
          if (flipNode.dataset['srcset']) flipNode.setAttribute('srcset', flipNode.dataset['srcset']);
        });

        if (imageNode) {
          imageNode.addEventListener('load', function () {
            return elementNode.classList.add(_this3.options.loadedClassName);
          });
        }
      } // Lazy-load background
      else {
          elementNode.classList.add(this.options.loadClassName);
        }
    }
  }]);

  return LazyLoad;
}();

exports.default = LazyLoad;
new LazyLoad(document.querySelectorAll('[data-plugin=lazy-load]'));

},{}],22:[function(require,module,exports){
"use strict";

var _bootstrap = _interopRequireDefault(require("../../imports/_bootstrap"));

var _modeResize = _interopRequireDefault(require("../base/partials/javascripts/mode-resize"));

var ScrollLock = _interopRequireWildcard(require("body-scroll-lock/lib/bodyScrollLock.es6.js"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import Xwiper from 'xwiper/src';
var baseSelector = '[data-plugin=modal-dialog]';
var baseNode = document.querySelector(baseSelector);

if (baseNode) {
  // Initialize mode-resize event
  var modeResize = new _modeResize.default();

  var initializeDOM = function initializeDOM(parentNode) {
    var html = '<div id="loader" class="modal fade">' + '<div class="modal-dialog loader">' + '<div class="modal-content">' + '<div class="spinner" role="status">' + '<span class="loading">Loading...</span>' + '</div>' + '</div>' + '</div>' + '</div>' + '<div id="reviews" class="modal fade">' + '<div class="modal-dialog">' + '<div class="modal-content"></div>' + '</div>' + '</div>' + '<div id="projects" class="modal fade">' + '<div class="modal-dialog">' + '<div class="modal-content"></div>' + '</div>' + '</div>';
    parentNode.insertAdjacentHTML('beforeend', html);
    return parentNode;
  };

  var attachModal = function attachModal(selector, file) {
    // Remembers the width of the modal
    // See updateSlideHeights()
    var lastWidth; // Modal elements

    var modalNode = document.querySelector(selector);
    var modalContentNode = modalNode.querySelector('.modal-content'); // All these references can only be resolved after setting modal content

    var carouselNode = null;
    var slideNodes = null;
    var slideNextButton = null;
    var slidePrevButton = null;
    var pageNumber = null;
    var pageCount = null;
    var modal = new _bootstrap.default.Modal(modalNode, {});
    var carousel = null; // let xwiper = null;

    function retrieveAjaxContent(file) {
      return fetch(file).then(function (response) {
        return response.text();
      });
    }

    function toggleCarouselWillChange(value) {
      carouselNode.style.willChange = value ? 'opacity, transform' : '';
    }

    function toggleBodyScroll(value) {
      if (value) ScrollLock.enableBodyScroll(modalNode);else ScrollLock.disableBodyScroll(modalNode);
    }

    function toggleModalFastCarousel(value) {
      carouselNode.classList.toggle('slide', !value);
      modalNode.classList.toggle('modal-fast-slides', value);
      modalNode.classList.toggle('modal-fast-height', value);
    }

    function updateSlideHeights(setHeight) {
      // Remember initial style
      var initialDisplayValue = modalNode.style.display; // Temporarily show dialog to make calculations possible

      modalNode.style.display = 'block';

      if (modalContentNode.clientWidth !== 0 && modalContentNode.clientWidth !== lastWidth) {
        // Remember current width as recalculated one
        lastWidth = modalContentNode.clientWidth; // Calculate slide heights

        slideNodes.forEach(function (slideNode) {
          // Is this slide active?
          var isActive = slideNode.classList.contains('active'); // Recalculate slide height

          slideNode.classList.toggle('active', true);
          slideNode.dataset.height = slideNode.clientHeight;
          slideNode.classList.toggle('active', isActive); // Update height to match active slide

          if (isActive && setHeight) {
            carouselNode.style.height = slideNode.dataset.height + 'px';
          }
        });
      } // Remove temporary show hack


      modalNode.style.display = initialDisplayValue;
    }

    function handleWindowResize() {
      toggleModalFastCarousel(true);
      updateSlideHeights(true);
      toggleModalFastCarousel(false);
    }

    function handleKeydown(e) {
      if (e.which === 39) carouselSlideBy(+1);
      if (e.which === 37) carouselSlideBy(-1);
    } // Update paginator


    function updatePagination(slideNode) {
      pageNumber.innerText = slideNodes.indexOf(slideNode) + 1;
      pageCount.innerText = slideNodes.length;
    } // Update carousel height


    function updateSlideHeight(slideNode) {
      carouselNode.style.height = slideNode.dataset.height + 'px';
    } // Carousel slide to


    function carouselSlideTo(index) {
      toggleModalFastCarousel(true);
      carousel.slideTo(index);
      toggleModalFastCarousel(false);
    } // Carousel slide by


    function carouselSlideBy(shift) {
      carousel.slideTo(carousel.getActiveIndex() + shift);
    }

    modalNode.addEventListener('show.bs.modal', function () {
      // Global flag (used by audio player)
      window.modalIsOpen = true; // Detach parallax

      window.toggleParallax && window.toggleParallax(false); // Pause quotes carousel

      window.toggleQuotesCarousel && window.toggleQuotesCarousel(false); // Enable will-change

      toggleCarouselWillChange(true); // Update slide heights

      updateSlideHeights(false);
    });
    modalNode.addEventListener('shown.bs.modal', function () {
      toggleBodyScroll(false);
      window.addEventListener('mode-resize', handleWindowResize);
      window.addEventListener('keydown', handleKeydown);
    });
    modalNode.addEventListener('hide.bs.modal', function () {
      toggleBodyScroll(true);
      window.removeEventListener('mode-resize', handleWindowResize);
      window.removeEventListener('keydown', handleKeydown);
    });
    modalNode.addEventListener('hidden.bs.modal', function () {
      // Reattach parallax
      window.toggleParallax && window.toggleParallax(true); // Pause quotes carousel

      window.toggleQuotesCarousel && window.toggleQuotesCarousel(true); // Disable will-change

      toggleCarouselWillChange(false); // Global flag (used by audio player)

      window.modalIsOpen = false;
    });
    return function (pageIndex) {
      if (!modalContentNode.children.length) {
        loaderModal.show();
        setTimeout(function () {
          retrieveAjaxContent(file).then(function (content) {
            // Set DOM content first
            modal.setContent(content); // Carousel nodes

            carouselNode = modalContentNode.querySelector('.carousel'); // Slide nodes

            slideNodes = Array.prototype.slice.call(carouselNode.querySelectorAll('.carousel-item')); // Navigation nodes

            slideNextButton = modalContentNode.querySelector('.modal-footer .slide-next');
            slidePrevButton = modalContentNode.querySelector('.modal-footer .slide-prev');
            pageNumber = modalContentNode.querySelector('.modal-footer .page-number');
            pageCount = modalContentNode.querySelector('.modal-footer .page-count'); // Carousel instance

            carousel = new _bootstrap.default.Carousel(carouselNode, {
              interval: false,
              keyboard: false
            }); // Initially set content height equal to active slide height

            updateSlideHeight(carouselNode.querySelector('.active'));
            updatePagination(carouselNode.querySelector('.active')); // Handle slide event

            carouselNode.addEventListener('slide.bs.carousel', function (e) {
              updateSlideHeight(e.relatedTarget);
              updatePagination(e.relatedTarget);
            });
            slidePrevButton.addEventListener('click', carouselSlideBy.bind(this, -1));
            slideNextButton.addEventListener('click', carouselSlideBy.bind(this, +1)); // Attach swipe detection
            // xwiper = new Xwiper(modalContentNode, {threshold: 100, passive: true});
            // Swipe gesture handlers
            // xwiper.onSwipeLeft(carouselSlideBy.bind(this, +1));
            // xwiper.onSwipeRight(carouselSlideBy.bind(this, -1));
            // Show modal
            // if (isLoading) {

            modal.show();
            carouselSlideTo(pageIndex); // }
          });
        }, 500);
      } else {
        modal.show();
        carouselSlideTo(pageIndex);
      }
    };
  };

  var blockNode = initializeDOM(document.body);
  var loaderModalNode = blockNode.querySelector('#loader');
  var loaderModal = new _bootstrap.default.Modal(loaderModalNode, {}); // let isLoading = null;
  //
  // loaderModalNode.addEventListener('show.bs.modal', function() {console.log('isLoading = true'); isLoading = true;});
  // loaderModalNode.addEventListener('hide.bs.modal', function() {console.log('isLoading = false'); isLoading = false;});
  // Initializing calls
  //

  var showReviewsModal = attachModal('#reviews', 'reviews.html');
  var showProjectsModal = attachModal('#projects', 'projects.html'); // External callbacks
  //

  window.openReview = function (pageId) {
    showReviewsModal(pageId - 1);
  };

  window.openProject = function (pageId) {
    showProjectsModal(pageId - 1);
  };
}

},{"../../imports/_bootstrap":11,"../base/partials/javascripts/mode-resize":14,"body-scroll-lock/lib/bodyScrollLock.es6.js":1}],23:[function(require,module,exports){
"use strict";

var _rellaxParallax = _interopRequireDefault(require("../base/partials/javascripts/rellax-parallax"));

var _this = void 0;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var blockSelector = '[data-plugin=rellax-parallax]';
var blockNodes = document.querySelectorAll(blockSelector);

if (blockNodes.length) {
  // let resizeTimer, resizeTimeout = 250;
  var rellaxString = 'Rellax';
  var shapeSelector = '.rellax';

  var toggle = function toggle(blockNode, value) {
    var rellax = blockNode[rellaxString];

    if (rellax) {
      if (value) {
        blockNode.classList.toggle('rellax-animate', false);
        blockNode.classList.toggle('rellax-visible', false);
        rellax.attach();
        rellax.update(); // Delay is required to prevent movement animation when rellax shape scrolls in

        window.requestAnimationFrame(function () {
          blockNode.classList.toggle('rellax-animate', true);
          blockNode.classList.toggle('rellax-visible', true);
        });
      } else {
        rellax.update();
        rellax.detach();
        blockNode.classList.toggle('rellax-visible', false); // blockNode.addEventListener('transitionend', function() {
        //   blockNode.classList.toggle('rellax-animate', false);
        // }, {once: true});
      }
    }
  }; // let screen = new OnScreen({tolerance: -250, debounce: 5});
  // screen.on('enter', blockSelector, function(blockNode) {toggle(blockNode, true);});
  // screen.on('leave', blockSelector, function(blockNode) {toggle(blockNode, false);});
  // Attach parallax


  blockNodes.forEach(function (blockNode) {
    var shapes = blockNode.querySelectorAll(shapeSelector);
    var config = {
      wrapper: blockNode,
      round: false,
      scroll: false
    };

    if (shapes.length) {
      blockNode[rellaxString] = new _rellaxParallax.default(shapes, config);
    }
  }); // Attach Intersection Observer

  blockNodes.forEach(function (blockNode) {
    var sectionNode = blockNode.closest('section');

    if (sectionNode) {
      sectionNode.addEventListener('enter', toggle.bind(_this, blockNode, true));
      sectionNode.addEventListener('leave', toggle.bind(_this, blockNode, false));
    }
  });
  window.addEventListener('mode-resize', function () {
    // clearTimeout(resizeTimer);
    // resizeTimer = setTimeout(window.updateParallax, resizeTimeout);
    window.updateParallax();
  });

  window.updateParallax = function () {
    blockNodes.forEach(function (blockNode) {
      var rellax = blockNode[rellaxString];

      if (rellax) {
        rellax.init();
      }
    });
  };

  window.toggleParallax = function (value) {
    if (value) {
      // console.log('Toggle parallax: ', value);
      // screen.attach();
      blockNodes.forEach(function (blockNode) {
        var rellax = blockNode[rellaxString];

        if (rellax) {
          if (rellax.detached) {
            toggle(blockNode, true);
            delete rellax.detached;
          }
        }
      });
    } else {
      // screen.destroy();
      blockNodes.forEach(function (blockNode) {
        var rellax = blockNode[rellaxString];

        if (rellax) {
          if (rellax.pause) {
            blockNode.classList.toggle('rellax-animate', false);
          } else {
            blockNode.classList.toggle('rellax-visible', false);
            rellax.detach();
            rellax.detached = true;
          }
        }
      });
    }
  };

  window.scrollParallax = function (scrollY) {
    blockNodes.forEach(function (blockNode) {
      var rellax = blockNode[rellaxString];

      if (rellax) {
        blockNode.classList.toggle('rellax-animate', false);
        blockNode.classList.toggle('rellax-visible', false);
        blockNode[rellaxString].refresh(scrollY);
        blockNode[rellaxString].detach();
      }
    });
  };
}

},{"../base/partials/javascripts/rellax-parallax":16}],24:[function(require,module,exports){
"use strict";

var _mousetrap = _interopRequireDefault(require("mousetrap"));

var _pell = _interopRequireDefault(require("pell/dist/pell"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var baseSelector = '[data-plugin=pell-editor]';
var baseNode = document.querySelector(baseSelector);

var detectContentEditable = function detectContentEditable() {
  if (!document.documentElement.contentEditable) {
    return false;
  } else {
    var div = document.createElement('div');
    div.contentEditable = true;
    return div.contentEditable;
  }
};

if (baseNode && detectContentEditable()) {
  // <div class="form-control h-auto d-none" spellcheck="false"></div>
  var textareaNode = baseNode;
  textareaNode.style.display = 'none';
  var html = '<div class="pell-editor ' + textareaNode.className + '" style="height:auto;" spellcheck="false">' + '<div class="pell"></div>' + '</div>';
  textareaNode.insertAdjacentHTML('afterEnd', html);
  var editorNode = textareaNode.nextElementSibling;
  var pellNode = editorNode.firstElementChild;
  var actions = [{
    name: 'bold',
    icon: 'bold',
    title: 'Bold',
    result: 'bold'
  }, {
    name: 'italic',
    icon: 'italic',
    title: 'Italic',
    result: 'italic'
  }, {
    name: 'underline',
    icon: 'underline',
    title: 'Underline',
    result: 'underline'
  }, {
    name: 'strikethrough',
    icon: 'strikethrough',
    title: 'Strikethrough',
    result: 'strikethrough'
  }, {
    name: 'olist',
    icon: 'olist',
    title: 'Ordered list',
    result: 'insertOrderedList'
  }, {
    name: 'ulist',
    icon: 'ulist',
    title: 'Unordered list',
    result: 'insertUnorderedList'
  }, {
    name: 'indent',
    icon: 'indent',
    title: 'Indent',
    result: 'indent'
  }, {
    name: 'outdent',
    icon: 'outdent',
    title: 'Outdent',
    result: 'outdent'
  }];
  actions = actions.map(function (item) {
    item.icon = '<i class="icon icon-edit-' + item.icon + '"></i>';
    item.result = _pell.default.exec.bind(this, item.result);
    return item;
  });

  _pell.default.init({
    element: pellNode,
    defaultParagraphSeparator: 'p',
    actions: actions,
    styleWithCSS: true,
    onChange: function onChange(html) {
      textareaNode.textContent = html;
    }
  });

  var editorActionbarNode = pellNode.querySelector('.pell-actionbar');
  var editorContentNode = pellNode.querySelector('.pell-content'); // Form submit hotkey

  (0, _mousetrap.default)(editorContentNode).bind(['shift+enter', 'mod+enter'], function (e) {
    console.log('submit!');
    e.preventDefault();
  }); // Editor hotkeys

  (0, _mousetrap.default)(editorContentNode).bind('mod+b', function (e) {
    _pell.default.exec('bold');

    e.preventDefault();
  });
  (0, _mousetrap.default)(editorContentNode).bind('mod+i', function (e) {
    _pell.default.exec('italic');

    e.preventDefault();
  });
  (0, _mousetrap.default)(editorContentNode).bind('mod+u', function (e) {
    _pell.default.exec('underline');

    e.preventDefault();
  });
  (0, _mousetrap.default)(editorContentNode).bind('tab', function (e) {
    _pell.default.exec('indent');

    e.preventDefault();
  });
  (0, _mousetrap.default)(editorContentNode).bind('shift+tab', function (e) {
    _pell.default.exec('outdent');

    e.preventDefault();
  }); // Manage focus outline of the container

  editorContentNode.addEventListener('focus', function () {
    editorNode.classList.add('focus');
  });
  editorContentNode.addEventListener('blur', function () {
    editorNode.classList.remove('focus');
  }); // Prevent blur event when clicking toolbar

  editorActionbarNode.addEventListener('mousedown', function (e) {
    e.preventDefault();
  });
}

},{"mousetrap":7,"pell/dist/pell":8}],25:[function(require,module,exports){
"use strict";

var _src = _interopRequireDefault(require("detect-it/src"));

var _smoothScroll = _interopRequireDefault(require("smooth-scroll/src/js/smooth-scroll"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var baseSelector = 'body[data-plugin=smooth-scroll]';
var baseNode = document.querySelector(baseSelector);

if (baseNode) {
  var linkSelector = 'a[href*="#"]';
  var smoothScrollMode = 'mouse';

  if (_src.default.primaryInput === smoothScrollMode) {
    // easeInOutQuad, easeInOutCubic, easeInOutQuart, easeInOutQuint
    var scroll = new _smoothScroll.default(linkSelector, {
      speed: 500
    });
    window.animateScroll = scroll.animateScroll;
    window.cancelScroll = scroll.cancelScroll;

    var handleScroll = function handleScroll(e) {
      //console.log(e.detail.anchor);
      if (e.type === 'scrollStart') {
        var nodeOffsetTop = Math.round(e.detail.anchor.getBoundingClientRect().top + window.pageYOffset);
        window.scrollParallax && window.scrollParallax(nodeOffsetTop);
        window.toggleParallax && window.toggleParallax(false);
      }

      if (e.type === 'scrollStop') {
        window.toggleParallax && window.toggleParallax(true);
      }
    };

    document.addEventListener('scrollStart', handleScroll, false);
    document.addEventListener('scrollStop', handleScroll, false);
  } else {
    var linkNodes = document.querySelectorAll(linkSelector);

    for (var i = 0; i < linkNodes.length; i++) {
      linkNodes[i].addEventListener('click', function (e) {
        var href = e.currentTarget.getAttribute('href');
        var node = document.querySelector(href);
        var nodeOffsetTop = node ? Math.round(node.getBoundingClientRect().top + window.pageYOffset) : 0;
        window.scrollParallax && window.scrollParallax(nodeOffsetTop);
        node ? node.scrollIntoView(true) : window.scrollTo({
          top: 0
        });
        e.preventDefault();
      });
    }
  }
}

},{"detect-it/src":3,"smooth-scroll/src/js/smooth-scroll":9}]},{},[12]);

//# sourceMappingURL=index.js.map
