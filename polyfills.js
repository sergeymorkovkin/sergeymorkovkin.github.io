var debug = false;
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

/*
 * Internet explorer generates pointer events by default for all input types like mouse, pen or touch (finger).
 * Touchr is generating touch events only for touch type by default but it can be overwritten by
 * window.Touchr_ALLOWED_POINTER_TYPE bitmask property. It can have values:
 * 1 for touch
 * 2 for mouse
 * 4 for pen
 * and their combinations.
 */
(function (window) {
  var IE_10 = !!window.navigator.msPointerEnabled,
      // Check below can mark as IE11+ also other browsers which implements pointer events in future
  // that is not issue, because touch capability is tested in IF statement bellow.
  // Note since Edge 16/Windows 10 1709 the property 'window.navigator.pointerEnabled' is undefined.
  IE_11_PLUS = !!window.navigator.pointerEnabled || !!window.PointerEvent; // Only pointer enabled browsers without touch capability.

  if (IE_10 || IE_11_PLUS && !('ontouchstart' in window)) {
    var document = window.document,
        POINTER_DOWN = IE_11_PLUS ? "pointerdown" : "MSPointerDown",
        POINTER_UP = IE_11_PLUS ? "pointerup" : "MSPointerUp",
        POINTER_MOVE = IE_11_PLUS ? "pointermove" : "MSPointerMove",
        POINTER_CANCEL = IE_11_PLUS ? "pointercancel" : "MSPointerCancel",
        POINTER_TYPE_TOUCH = IE_11_PLUS ? "touch" : MSPointerEvent.MSPOINTER_TYPE_TOUCH,
        POINTER_TYPE_MOUSE = IE_11_PLUS ? "mouse" : MSPointerEvent.MSPOINTER_TYPE_MOUSE,
        POINTER_TYPE_PEN = IE_11_PLUS ? "pen" : MSPointerEvent.MSPOINTER_TYPE_PEN,
        //IE11+ has also unknown type which Touchr doesn't support
    GESTURE_START = "MSGestureStart",
        GESTURE_CHANGE = "MSGestureChange",
        GESTURE_END = "MSGestureEnd",
        TOUCH_ACTION = IE_11_PLUS ? "touchAction" : "msTouchAction",
        _180_OVER_PI = 180 / Math.PI,
        // Which pointer types will be used for generating touch events: 1 - touch, 2 - mouse, 4 - pen or their combination
    ALLOWED_POINTER_TYPE = window.Touchr_ALLOWED_POINTER_TYPE || 1,
        createEvent = function createEvent(eventName, target, params) {
      var k,
          event = document.createEvent("Event");
      event.initEvent(eventName, true, true);

      for (k in params) {
        event[k] = params[k];
      }

      target.dispatchEvent(event);
    },

    /**
     * ECMAScript 5 accessors to the rescue
     * @see http://perfectionkills.com/how-ecmascript-5-still-does-not-allow-to-subclass-an-array/
     */
    makeSubArray = function () {
      var MAX_SIGNED_INT_VALUE = Math.pow(2, 32) - 1,
          hasOwnProperty = Object.prototype.hasOwnProperty;

      function ToUint32(value) {
        return value >>> 0;
      }

      function getMaxIndexProperty(object) {
        var maxIndex = -1,
            isValidProperty,
            prop;

        for (prop in object) {
          isValidProperty = String(ToUint32(prop)) === prop && ToUint32(prop) !== MAX_SIGNED_INT_VALUE && hasOwnProperty.call(object, prop);

          if (isValidProperty && prop > maxIndex) {
            maxIndex = prop;
          }
        }

        return maxIndex;
      }

      return function (methods) {
        var length = 0;
        methods = methods || {};
        methods.length = {
          get: function get() {
            var maxIndexProperty = +getMaxIndexProperty(this);
            return Math.max(length, maxIndexProperty + 1);
          },
          set: function set(value) {
            var constrainedValue = ToUint32(value);

            if (constrainedValue !== +value) {
              throw new RangeError();
            }

            for (var i = constrainedValue, len = this.length; i < len; i++) {
              delete this[i];
            }

            length = constrainedValue;
          }
        };
        methods.toString = {
          value: Array.prototype.join
        };
        return Object.create(Array.prototype, methods);
      };
    }(),
        // methods passed to TouchList closure method to extend Array
    touchListMethods = {
      /**
       * Returns touch by id. This method fulfill the TouchList interface.
       * @param {Number} id
       * @returns {Touch}
       */
      identifiedTouch: {
        value: function value(id) {
          var length = this.length;

          while (length--) {
            if (this[length].identifier === id) return this[length];
          }

          return undefined;
        }
      },

      /**
       * Returns touch by index. This method fulfill the TouchList interface.
       * @param {Number} index
       * @returns {Touch}
       */
      item: {
        value: function value(index) {
          return this[index];
        }
      },

      /**
       * Returns touch index
       * @param {Touch} touch
       * @returns {Number}
       */
      _touchIndex: {
        value: function value(touch) {
          var length = this.length;

          while (length--) {
            if (this[length].pointerId == touch.pointerId) return length;
          }

          return -1;
        }
      },

      /**
       * Add all events and convert them to touches
       * @param {Event[]} events
       */
      _addAll: {
        value: function value(events) {
          var i = 0,
              length = events.length;

          for (; i < length; i++) {
            this._add(events[i]);
          }
        }
      },

      /**
       * Add and MSPointer event and convert it to Touch like object
       * @param {Event} event
       */
      _add: {
        value: function value(event) {
          var index = this._touchIndex(event);

          index = index < 0 ? this.length : index; //normalizing Pointer to Touch

          event.type = POINTER_MOVE;
          event.identifier = event.pointerId; //in DOC is mentioned that it is 0..255 but actually it returns 0..1 value
          //returns 0.5 for mouse down buttons in IE11, should it be issue?

          event.force = event.pressure; //default values for Touch which we cannot obtain from Pointer

          event.radiusX = event.radiusY = 1;
          event.rotationAngle = 0;
          this[index] = event;
        }
      },

      /**
       * Removes an event from this touch list.
       * @param {Event} event
       */
      _remove: {
        value: function value(event) {
          var index = this._touchIndex(event);

          if (index >= 0) {
            this.splice(index, 1);
          }
        }
      }
    },

    /**
     * This class store touches in an list which can be also accessible as array which is
     * little bit bad because TouchList have to extend Array. Because we are aiming on
     * IE10+ we can use ECMAScript5 solution.
     * @extends Array
     * @see http://www.w3.org/TR/2011/WD-touch-events-20110913/#touchlist-interface
     * @see https://developer.mozilla.org/en-US/docs/DOM/TouchList
     */
    TouchList = function (methods) {
      return function () {
        var arr = makeSubArray(methods);

        if (arguments.length === 1) {
          arr.length = arguments[0];
        } else {
          arr.push.apply(arr, arguments);
        }

        return arr;
      };
    }(touchListMethods),

    /**
     * list of all touches running during life cycle
     * @type TouchList
     */
    generalTouchesHolder,

    /**
     * Storage of link between pointer {id} and original target
     * @type Object
     */
    pointerToTarget = {},

    /**
     * General gesture object which fires MSGesture events whenever any associated MSPointer event changed.
     */
    gesture = window.MSGesture ? new MSGesture() : null,
        gestureScale = 1,
        gestureRotation = 0,

    /**
     * Storage of targets and anonymous MSPointerStart handlers for later
     * unregistering
     * @type Array
     */
    attachedPointerStartMethods = [],

    /**
     * Checks if node is some of parent children or sub-children
     * @param {HTMLElement|Document} parent
     * @param {HTMLElement} node
     * @returns {Boolean}
     */
    checkSameTarget = function checkSameTarget(parent, node) {
      if (node) {
        if (parent === node) {
          return true;
        } else {
          return checkSameTarget(parent, node.parentNode);
        }
      } else {
        return false;
      }
    },

    /**
     * Returns bitmask type of pointer to compare with allowed pointer types
     * @param {Number|String} pointerType
     * @returns {Number}
     */
    pointerTypeToBitmask = function pointerTypeToBitmask(pointerType) {
      if (pointerType == POINTER_TYPE_TOUCH) {
        return 1;
      } else if (pointerType == POINTER_TYPE_MOUSE) {
        return 2;
      } else {
        return 4;
      }
    },

    /**
     * Main function which is rewriting the MSPointer event to touch event
     * and preparing all the necessary lists of touches.
     * @param {Event} evt
     */
    pointerListener = function pointerListener(evt) {
      var type,
          i,
          target = evt.target,
          originalTarget,
          changedTouches,
          targetTouches; // Skip pointers which are not allowed by users:

      if (!(pointerTypeToBitmask(evt.pointerType) & ALLOWED_POINTER_TYPE)) {
        return;
      }

      if (evt.type === POINTER_DOWN) {
        generalTouchesHolder._add(evt);

        pointerToTarget[evt.pointerId] = evt.target;
        type = "touchstart"; // Fires MSGesture event when we have at least two pointers in our holder
        // (adding pointers to gesture object immediately fires Gesture event)

        if (generalTouchesHolder.length > 1) {
          gesture.target = evt.target;

          for (i = 0; i < generalTouchesHolder.length; i++) {
            // Adds to gesture only touches
            // It is not necessary to create separate gesture for mouse or pen pointers
            // because they cannot be present more than by 1 pointer.
            if (generalTouchesHolder[i].pointerType === POINTER_TYPE_TOUCH) {
              gesture.addPointer(generalTouchesHolder[i].pointerId);
            }
          }
        }
      }

      if (evt.type === POINTER_MOVE && generalTouchesHolder.identifiedTouch(evt.pointerId)) {
        generalTouchesHolder._add(evt);

        type = "touchmove";
      } //Preparation of touch lists have to be done before pointerup/MSPointerUp where we delete some information
      //Which touch fired this event, because we know that MSPointer event is fired for every
      //changed pointer than we create a list only with actual pointer


      changedTouches = document.createTouchList(evt); //Target touches is list of touches which started on (touchstart) on target element, they
      //are in this array even if these touches have coordinates outside target elements

      targetTouches = document.createTouchList();

      for (i = 0; i < generalTouchesHolder.length; i++) {
        //targetTouches._add(generalTouchesHolder[i]);
        //check if the pointerTarget is in the target
        if (checkSameTarget(target, pointerToTarget[generalTouchesHolder[i].identifier])) {
          targetTouches._add(generalTouchesHolder[i]);
        }
      }

      originalTarget = pointerToTarget[evt.pointerId];

      if (evt.type === POINTER_UP || evt.type === POINTER_CANCEL) {
        generalTouchesHolder._remove(evt);

        pointerToTarget[evt.pointerId] = null;
        delete pointerToTarget[evt.pointerId];
        type = "touchend"; // Fires MSGestureEnd event when there is only one ore zero touches:

        if (generalTouchesHolder.length <= 1) {
          gesture.stop();
        }
      } //console.log("+", evt.type, evt.pointerType, generalTouchesHolder.length, evt.target.nodeName+"#"+evt.target.id);


      if (type && originalTarget) {
        createEvent(type, originalTarget, {
          touches: generalTouchesHolder,
          changedTouches: changedTouches,
          targetTouches: targetTouches
        });
      }
    },

    /**
     * Main function which is rewriting the MSGesture event to gesture event.
     * @param {Event} evt
     */
    gestureListener = function gestureListener(evt) {
      //TODO: check first, other than IE (FF?), browser which implements pointer events how to make gestures from pointers. Maybe it would be mix of pointer/gesture events.
      var type, scale, rotation;

      if (evt.type === GESTURE_START) {
        type = "gesturestart";
      } else if (evt.type === GESTURE_CHANGE) {
        type = "gesturechange";
      } else if (evt.type === GESTURE_END) {
        type = "gestureend";
      } // -------- SCALE ---------
      //MSGesture:
      //Scale values represent the difference in scale from the last MSGestureEvent that was fired.
      //Apple:
      //The distance between two fingers since the start of an event, as a multiplier of the initial distance. The initial value is 1.0.
      // ------- ROTATION -------
      //MSGesture:
      //Clockwise rotation of the cursor around its own major axis expressed as a value in radians from the last MSGestureEvent of the interaction.
      //Apple:
      //The delta rotation since the start of an event, in degrees, where clockwise is positive and counter-clockwise is negative. The initial value is 0.0


      if (evt.type === GESTURE_START) {
        scale = gestureScale = 1;
        rotation = gestureRotation = 0;
      } else {
        scale = gestureScale = gestureScale + (evt.scale - 1); //* evt.scale;

        rotation = gestureRotation = gestureRotation + evt.rotation * _180_OVER_PI;
      }

      createEvent(type, evt.target, {
        scale: scale,
        rotation: rotation,
        screenX: evt.screenX,
        screenY: evt.screenY
      });
    },

    /**
     * This method augments event listener methods on given class to call
     * our own method which attach/detach the MSPointer events handlers
     * when user tries to attach touch events.
     * @param {Function} elementClass Element class like HTMLElement or Document
     */
    augmentEventListener = function augmentEventListener(elementClass) {
      var customAddEventListener = attachTouchEvents,
          customRemoveEventListener = removeTouchEvents,
          oldAddEventListener = elementClass.prototype.addEventListener,
          oldRemoveEventListener = elementClass.prototype.removeEventListener;

      elementClass.prototype.addEventListener = function (type, listener, useCapture) {
        //"this" is HTML element
        if (type.indexOf("gesture") === 0 || type.indexOf("touch") === 0) {
          customAddEventListener.call(this, type, listener, useCapture);
        }

        oldAddEventListener.call(this, type, listener, useCapture);
      };

      elementClass.prototype.removeEventListener = function (type, listener, useCapture) {
        if (type.indexOf("gesture") === 0 || type.indexOf("touch") === 0) {
          customRemoveEventListener.call(this, type, listener, useCapture);
        }

        oldRemoveEventListener.call(this, type, listener, useCapture);
      };
    },

    /**
     * This method attach event handler for MSPointer / MSGesture events when user
     * tries to attach touch / gesture events.
     * @param {String} type
     * @param {Function} listener
     * @param {Boolean} useCapture
     */
    attachTouchEvents = function attachTouchEvents(type, listener, useCapture) {
      //element owner document or document itself
      var doc = this.nodeType == 9 ? this : this.ownerDocument; // Because we are listening only on document, it is not necessary to
      // attach events on one document more times

      if (attachedPointerStartMethods.indexOf(doc) < 0) {
        //TODO: reference on node, listen on DOM removal to clean the ref?
        attachedPointerStartMethods.push(doc);
        doc.addEventListener(POINTER_DOWN, pointerListener, useCapture);
        doc.addEventListener(POINTER_MOVE, pointerListener, useCapture);
        doc.addEventListener(POINTER_UP, pointerListener, useCapture);
        doc.addEventListener(POINTER_CANCEL, pointerListener, useCapture);
        doc.addEventListener(GESTURE_START, gestureListener, useCapture);
        doc.addEventListener(GESTURE_CHANGE, gestureListener, useCapture);
        doc.addEventListener(GESTURE_END, gestureListener, useCapture);
      } // e.g. Document has no style


      if (this.style && (typeof this.style[TOUCH_ACTION] == "undefined" || !this.style[TOUCH_ACTION])) {
        this.style[TOUCH_ACTION] = "none";
      }
    },

    /**
     * This method detach event handler for MSPointer / MSGesture events when user
     * tries to detach touch / gesture events.
     * @param {String} type
     * @param {Function} listener
     * @param {Boolean} useCapture
     */
    removeTouchEvents = function removeTouchEvents(type, listener, useCapture) {//todo: are we able to understand when all listeners are unregistered and shall be removed?
    };
    /*
     * Adding DocumentTouch interface
     * @see http://www.w3.org/TR/2011/WD-touch-events-20110505/#idl-def-DocumentTouch
     */

    /**
     * Create touches list from array or touches or given touch
     * @param {Touch[]|Touch} touches
     * @returns {TouchList}
     */


    document.createTouchList = function (touches) {
      var touchList = new TouchList();

      if (touches) {
        if (touches.length) {
          touchList._addAll(touches);
        } else {
          touchList._add(touches);
        }
      }

      return touchList;
    };
    /*******  Fakes which persuade other code to use touch events ********/

    /**
     * AbstractView is class for document.defaultView === window
     * @param {AbstractView} view
     * @param {EventTarget} target
     * @param {Number} identifier
     * @param {Number} pageX
     * @param {Number} pageY
     * @param {Number} screenX
     * @param {Number} screenY
     * @return {Touch}
     */


    document.createTouch = function (view, target, identifier, pageX, pageY, screenX, screenY) {
      return {
        identifier: identifier,
        screenX: screenX,
        screenY: screenY,
        //clientX: clientX,
        //clientY: clientY,
        pageX: pageX,
        pageY: pageY,
        target: target
      };
    }; //Fake Modernizer touch test
    //http://modernizr.github.com/Modernizr/touch.html


    if (!window.ontouchstart) window.ontouchstart = 1;
    /*******  End of fakes ***********************************/

    generalTouchesHolder = document.createTouchList(); // Overriding HTMLElement and HTMLDocument to hand over touch handler to MSPointer event handler

    augmentEventListener(HTMLElement);
    augmentEventListener(Document);
  }
})(window);

},{}],2:[function(require,module,exports){
(function (global){
"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

/* Polyfill service DEVELOPMENT MODE - for live use set NODE_ENV to 'production'
 * For detailed credits and licence information see https://github.com/financial-times/polyfill-service.
 * 
 * Features requested: CustomEvent,IntersectionObserver,IntersectionObserverEntry,HTMLPictureElement,fetch,Element.prototype.classList,Element.prototype.closest,Array.prototype.forEach,NodeList.prototype.forEach,Element.prototype.dataset,Array.prototype.includes,String.prototype.includes,Map,Set
 * 
 * - _ESAbstract.ArrayCreate, License: CC0 (required by "_ESAbstract.ArraySpeciesCreate", "Array.prototype.filter", "IntersectionObserver", "Array.prototype.map")
 * - _ESAbstract.Call, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.filter", "Array.prototype.map", "Array.prototype.some", "_ESAbstract.GetIterator", "Map", "Set", "_ESAbstract.IteratorClose", "_ESAbstract.IteratorNext", "_ESAbstract.ToPrimitive", "_ESAbstract.ToString", "Array.prototype.includes", "String.prototype.includes", "Array.prototype.indexOf", "_ESAbstract.OrdinaryToPrimitive")
 * - _ESAbstract.Get, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some", "_ESAbstract.IsRegExp", "String.prototype.includes", "_ESAbstract.IteratorComplete", "Map", "Set", "_ESAbstract.IteratorValue", "_ESAbstract.ArraySpeciesCreate", "_ESAbstract.GetPrototypeFromConstructor", "_ESAbstract.OrdinaryCreateFromConstructor", "Object.defineProperties", "Object.create", "_ESAbstract.GetIterator", "Symbol", "_ESAbstract.OrdinaryToPrimitive", "_ESAbstract.ToPrimitive", "_ESAbstract.ToString")
 * - _ESAbstract.HasProperty, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some")
 * - _ESAbstract.IsArray, License: CC0 (required by "Array.isArray", "IntersectionObserver", "Map", "Set", "_ESAbstract.ArraySpeciesCreate", "Array.prototype.filter", "Array.prototype.map")
 * - _ESAbstract.IsCallable, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Map", "Set", "Array.prototype.filter", "Array.prototype.map", "Array.prototype.some", "Function.prototype.bind", "_ESAbstract.GetMethod", "_ESAbstract.OrdinaryToPrimitive", "_ESAbstract.ToPrimitive", "_ESAbstract.ToString", "Array.prototype.includes", "String.prototype.includes", "Array.prototype.indexOf")
 * - _ESAbstract.RequireObjectCoercible, License: CC0 (required by "String.prototype.includes")
 * - _ESAbstract.SameValueNonNumber, License: CC0 (required by "_ESAbstract.SameValueZero", "Array.prototype.includes", "Map", "Set")
 * - _ESAbstract.ToBoolean, License: CC0 (required by "Array.prototype.filter", "IntersectionObserver", "Array.prototype.some", "_ESAbstract.IsRegExp", "String.prototype.includes", "_ESAbstract.IteratorComplete", "Map", "Set")
 * - _ESAbstract.ToInteger, License: CC0 (required by "Array.prototype.includes", "String.prototype.includes", "Array.prototype.indexOf", "IntersectionObserver", "_ESAbstract.ToLength", "Array.prototype.forEach", "fetch", "Array.prototype.filter", "Array.prototype.map", "Array.prototype.some")
 * - _ESAbstract.ToLength, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some")
 * - _ESAbstract.ToObject, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some", "_ESAbstract.GetV", "_ESAbstract.GetMethod", "Map", "Set", "_ESAbstract.GetIterator", "Object.defineProperties", "Object.create", "_ESAbstract.OrdinaryCreateFromConstructor", "Symbol")
 * - _ESAbstract.GetV, License: CC0 (required by "_ESAbstract.GetMethod", "Map", "Set", "_ESAbstract.GetIterator")
 * - _ESAbstract.GetMethod, License: CC0 (required by "Map", "Set", "_ESAbstract.GetIterator", "_ESAbstract.IteratorClose", "_ESAbstract.ToPrimitive", "_ESAbstract.ToString", "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "String.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some", "_ESAbstract.IsConstructor", "_ESAbstract.ArraySpeciesCreate")
 * - _ESAbstract.Type, License: CC0 (required by "Map", "_ESAbstract.ToString", "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "String.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some", "_ESAbstract.SameValueZero", "Set", "_ESAbstract.IsRegExp", "_ESAbstract.CreateIterResultObject", "_ESAbstract.GetIterator", "_ESAbstract.IteratorClose", "_ESAbstract.IteratorComplete", "_ESAbstract.IteratorNext", "_ESAbstract.IteratorValue", "Object.create", "_ESAbstract.OrdinaryCreateFromConstructor", "Symbol", "_ESAbstract.ArraySpeciesCreate", "_ESAbstract.ToPrimitive", "_ESAbstract.GetPrototypeFromConstructor", "Object.defineProperties", "_ESAbstract.IsConstructor", "_ESAbstract.OrdinaryToPrimitive")
 * - _ESAbstract.GetPrototypeFromConstructor, License: CC0 (required by "_ESAbstract.OrdinaryCreateFromConstructor", "Map", "Set")
 * - _ESAbstract.IsConstructor, License: CC0 (required by "_ESAbstract.ArraySpeciesCreate", "Array.prototype.filter", "IntersectionObserver", "Array.prototype.map", "_ESAbstract.Construct")
 * - _ESAbstract.IsRegExp, License: CC0 (required by "String.prototype.includes")
 * - _ESAbstract.IteratorClose, License: CC0 (required by "Map", "Set")
 * - _ESAbstract.IteratorComplete, License: CC0 (required by "Map", "Set", "_ESAbstract.IteratorStep")
 * - _ESAbstract.IteratorNext, License: CC0 (required by "Map", "Set", "_ESAbstract.IteratorStep")
 * - _ESAbstract.IteratorStep, License: CC0 (required by "Map", "Set")
 * - _ESAbstract.IteratorValue, License: CC0 (required by "Map", "Set")
 * - _ESAbstract.OrdinaryToPrimitive, License: CC0 (required by "_ESAbstract.ToPrimitive", "_ESAbstract.ToString", "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "String.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some")
 * - _ESAbstract.SameValueZero, License: CC0 (required by "Array.prototype.includes", "Map", "Set")
 * - _ESAbstract.ToPrimitive, License: CC0 (required by "_ESAbstract.ToString", "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "String.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some")
 * - _ESAbstract.ToString, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "String.prototype.includes", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some")
 * - Date.now, License: CC0 (required by "performance.now", "IntersectionObserver")
 * - document, License: CC0 (required by "Event", "CustomEvent", "IntersectionObserver", "~html5-elements", "HTMLPictureElement", "Element", "Element.prototype.classList", "Element.prototype.dataset", "document.querySelector", "Element.prototype.matches", "Element.prototype.closest")
 * - ~html5-elements, License: MIT (required by "HTMLPictureElement")
 * - Element, License: CC0 (required by "Element.prototype.classList", "Element.prototype.dataset", "Event", "CustomEvent", "IntersectionObserver", "Element.prototype.matches", "Element.prototype.closest", "document.querySelector")
 * - document.querySelector, License: CC0 (required by "Element.prototype.dataset", "Element.prototype.matches", "Element.prototype.closest")
 * - Element.prototype.matches, License: CC0 (required by "Element.prototype.closest")
 * - Element.prototype.closest, License: CC0
 * - HTMLPictureElement, License: MIT
 * - Object.defineProperty, License: CC0 (required by "IntersectionObserverEntry", "Element.prototype.classList", "Element.prototype.dataset", "Map", "Set", "Event", "CustomEvent", "IntersectionObserver", "_ESAbstract.CreateMethodProperty", "Array.prototype.forEach", "fetch", "Array.prototype.includes", "String.prototype.includes", "Array.isArray", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some", "Function.prototype.bind", "Object.getOwnPropertyNames", "_ESAbstract.OrdinaryCreateFromConstructor", "Symbol", "Symbol.iterator", "Symbol.species", "_DOMTokenList", "DOMTokenList", "_ESAbstract.CreateDataProperty", "_ESAbstract.CreateIterResultObject", "_ESAbstract.CreateDataPropertyOrThrow", "Object.defineProperties", "Object.create", "_ESAbstract.GetIterator")
 * - _DOMTokenList, License: ISC (required by "DOMTokenList", "Element.prototype.classList")
 * - DOMTokenList, License: CC0 (required by "Element.prototype.classList")
 * - _ESAbstract.CreateDataProperty, License: CC0 (required by "_ESAbstract.CreateIterResultObject", "Map", "Set", "_ESAbstract.CreateDataPropertyOrThrow", "Array.prototype.filter", "IntersectionObserver", "Array.prototype.map")
 * - _ESAbstract.CreateDataPropertyOrThrow, License: CC0 (required by "Array.prototype.filter", "IntersectionObserver", "Array.prototype.map")
 * - _ESAbstract.CreateIterResultObject, License: CC0 (required by "Map", "Set")
 * - _ESAbstract.CreateMethodProperty, License: CC0 (required by "Array.prototype.forEach", "IntersectionObserver", "fetch", "Array.prototype.includes", "String.prototype.includes", "Map", "Set", "Array.isArray", "Array.prototype.filter", "Array.prototype.indexOf", "Array.prototype.map", "Array.prototype.some", "Function.prototype.bind", "Object.getOwnPropertyNames", "Object.getOwnPropertyDescriptor", "Element.prototype.dataset", "Object.create", "_ESAbstract.GetIterator", "_ESAbstract.OrdinaryCreateFromConstructor", "Symbol", "Object.getPrototypeOf", "Object.freeze", "Object.keys", "Object.defineProperties")
 * - Array.isArray, License: CC0 (required by "IntersectionObserver", "Map", "Set")
 * - Array.prototype.forEach, License: CC0 (required by "IntersectionObserver", "fetch", "NodeList.prototype.forEach", "Symbol", "Map", "Set")
 * - NodeList.prototype.forEach, License: CC0
 * - Array.prototype.includes, License: MIT
 * - Array.prototype.indexOf, License: CC0 (required by "IntersectionObserver")
 * - Array.prototype.some, License: CC0 (required by "IntersectionObserver")
 * - Function.prototype.bind, License: MIT (required by "IntersectionObserver", "Object.getOwnPropertyDescriptor", "Element.prototype.dataset", "_ESAbstract.Construct", "_ESAbstract.ArraySpeciesCreate", "Array.prototype.filter", "Array.prototype.map")
 * - Element.prototype.classList, License: ISC
 * - Object.freeze, License: CC0 (required by "Symbol", "Map", "Set")
 * - Object.getOwnPropertyDescriptor, License: CC0 (required by "Element.prototype.dataset", "Symbol", "Map", "Set", "Object.defineProperties", "Object.create", "_ESAbstract.GetIterator", "_ESAbstract.OrdinaryCreateFromConstructor")
 * - Element.prototype.dataset, License: CC0
 * - Object.getOwnPropertyNames, License: CC0 (required by "fetch", "Symbol", "Map", "Set")
 * - Object.getPrototypeOf, License: CC0 (required by "_ESAbstract.OrdinaryCreateFromConstructor", "Map", "Set")
 * - Object.keys, License: MIT (required by "Symbol", "Map", "Set", "Object.defineProperties", "Object.create", "_ESAbstract.GetIterator", "_ESAbstract.OrdinaryCreateFromConstructor")
 * - Object.defineProperties, License: CC0 (required by "Object.create", "Map", "Set", "_ESAbstract.GetIterator", "_ESAbstract.OrdinaryCreateFromConstructor", "Symbol")
 * - Object.create, License: CC0 (required by "Map", "Set", "_ESAbstract.GetIterator", "_ESAbstract.OrdinaryCreateFromConstructor", "Symbol")
 * - _ESAbstract.GetIterator, License: CC0 (required by "Map", "Set")
 * - _ESAbstract.OrdinaryCreateFromConstructor, License: CC0 (required by "Map", "Set", "_ESAbstract.Construct", "_ESAbstract.ArraySpeciesCreate", "Array.prototype.filter", "IntersectionObserver", "Array.prototype.map")
 * - _ESAbstract.Construct, License: CC0 (required by "_ESAbstract.ArraySpeciesCreate", "Array.prototype.filter", "IntersectionObserver", "Array.prototype.map")
 * - _ESAbstract.ArraySpeciesCreate, License: CC0 (required by "Array.prototype.filter", "IntersectionObserver", "Array.prototype.map")
 * - Array.prototype.filter, License: CC0 (required by "IntersectionObserver", "Symbol", "Map", "Set")
 * - Array.prototype.map, License: CC0 (required by "IntersectionObserver", "Symbol", "Map", "Set")
 * - performance.now, License: CC0 (required by "IntersectionObserver")
 * - Promise, License: MIT (required by "fetch")
 * - String.prototype.includes, License: CC0
 * - Symbol, License: MIT (required by "Map", "Set", "Symbol.iterator", "Symbol.species")
 * - Symbol.iterator, License: MIT (required by "Map", "Set")
 * - Symbol.species, License: MIT (required by "Map", "Set")
 * - Map, License: CC0
 * - Set, License: CC0
 * - Window, License: CC0 (required by "Event", "CustomEvent", "IntersectionObserver", "getComputedStyle")
 * - Event, License: CC0 (required by "CustomEvent", "IntersectionObserver", "XMLHttpRequest", "fetch")
 * - CustomEvent, License: CC0
 * - getComputedStyle, License: CC0 (required by "IntersectionObserver")
 * - IntersectionObserver, License: CC0 (required by "IntersectionObserverEntry")
 * - IntersectionObserverEntry, License: CC0
 * - XMLHttpRequest, License: CC0 (required by "fetch")
 * - fetch, License: MIT */
(function (undefined) {
  // _ESAbstract.ArrayCreate
  // 9.4.2.2. ArrayCreate ( length [ , proto ] )
  function ArrayCreate(length
  /* [, proto] */
  ) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: length is an integer Number ≥ 0.
    // 2. If length is -0, set length to +0.
    if (1 / length === -Infinity) {
      length = 0;
    } // 3. If length>2^32-1, throw a RangeError exception.


    if (length > Math.pow(2, 32) - 1) {
      throw new RangeError('Invalid array length');
    } // 4. If proto is not present, set proto to the intrinsic object %ArrayPrototype%.
    // 5. Let A be a newly created Array exotic object.


    var A = []; // 6. Set A's essential internal methods except for [[DefineOwnProperty]] to the default ordinary object definitions specified in 9.1.
    // 7. Set A.[[DefineOwnProperty]] as specified in 9.4.2.1.
    // 8. Set A.[[Prototype]] to proto.
    // 9. Set A.[[Extensible]] to true.
    // 10. Perform ! OrdinaryDefineOwnProperty(A, "length", PropertyDescriptor{[[Value]]: length, [[Writable]]: true, [[Enumerable]]: false, [[Configurable]]: false}).

    A.length = length; // 11. Return A.

    return A;
  } // _ESAbstract.Call

  /* global IsCallable */
  // 7.3.12. Call ( F, V [ , argumentsList ] )


  function Call(F, V
  /* [, argumentsList] */
  ) {
    // eslint-disable-line no-unused-vars
    // 1. If argumentsList is not present, set argumentsList to a new empty List.
    var argumentsList = arguments.length > 2 ? arguments[2] : []; // 2. If IsCallable(F) is false, throw a TypeError exception.

    if (IsCallable(F) === false) {
      throw new TypeError(Object.prototype.toString.call(F) + 'is not a function.');
    } // 3. Return ? F.[[Call]](V, argumentsList).


    return F.apply(V, argumentsList);
  } // _ESAbstract.Get
  // 7.3.1. Get ( O, P )


  function Get(O, P) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(O) is Object.
    // 2. Assert: IsPropertyKey(P) is true.
    // 3. Return ? O.[[Get]](P, O).
    return O[P];
  } // _ESAbstract.HasProperty
  // 7.3.10. HasProperty ( O, P )


  function HasProperty(O, P) {
    // eslint-disable-line no-unused-vars
    // Assert: Type(O) is Object.
    // Assert: IsPropertyKey(P) is true.
    // Return ? O.[[HasProperty]](P).
    return P in O;
  } // _ESAbstract.IsArray
  // 7.2.2. IsArray ( argument )


  function IsArray(argument) {
    // eslint-disable-line no-unused-vars
    // 1. If Type(argument) is not Object, return false.
    // 2. If argument is an Array exotic object, return true.
    // 3. If argument is a Proxy exotic object, then
    // a. If argument.[[ProxyHandler]] is null, throw a TypeError exception.
    // b. Let target be argument.[[ProxyTarget]].
    // c. Return ? IsArray(target).
    // 4. Return false.
    // Polyfill.io - We can skip all the above steps and check the string returned from Object.prototype.toString().
    return Object.prototype.toString.call(argument) === '[object Array]';
  } // _ESAbstract.IsCallable
  // 7.2.3. IsCallable ( argument )


  function IsCallable(argument) {
    // eslint-disable-line no-unused-vars
    // 1. If Type(argument) is not Object, return false.
    // 2. If argument has a [[Call]] internal method, return true.
    // 3. Return false.
    // Polyfill.io - Only function objects have a [[Call]] internal method. This means we can simplify this function to check that the argument has a type of function.
    return typeof argument === 'function';
  } // _ESAbstract.RequireObjectCoercible
  // 7.2.1. RequireObjectCoercible ( argument )
  // The abstract operation ToObject converts argument to a value of type Object according to Table 12:
  // Table 12: ToObject Conversions

  /*
  |----------------------------------------------------------------------------------------------------------------------------------------------------|
  | Argument Type | Result                                                                                                                             |
  |----------------------------------------------------------------------------------------------------------------------------------------------------|
  | Undefined     | Throw a TypeError exception.                                                                                                       |
  | Null          | Throw a TypeError exception.                                                                                                       |
  | Boolean       | Return argument.                                                                                                                   |
  | Number        | Return argument.                                                                                                                   |
  | String        | Return argument.                                                                                                                   |
  | Symbol        | Return argument.                                                                                                                   |
  | Object        | Return argument.                                                                                                                   |
  |----------------------------------------------------------------------------------------------------------------------------------------------------|
  */


  function RequireObjectCoercible(argument) {
    // eslint-disable-line no-unused-vars
    if (argument === null || argument === undefined) {
      throw TypeError();
    }

    return argument;
  } // _ESAbstract.SameValueNonNumber
  // 7.2.12. SameValueNonNumber ( x, y )


  function SameValueNonNumber(x, y) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(x) is not Number.
    // 2. Assert: Type(x) is the same as Type(y).
    // 3. If Type(x) is Undefined, return true.
    // 4. If Type(x) is Null, return true.
    // 5. If Type(x) is String, then
    // a. If x and y are exactly the same sequence of code units (same length and same code units at corresponding indices), return true; otherwise, return false.
    // 6. If Type(x) is Boolean, then
    // a. If x and y are both true or both false, return true; otherwise, return false.
    // 7. If Type(x) is Symbol, then
    // a. If x and y are both the same Symbol value, return true; otherwise, return false.
    // 8. If x and y are the same Object value, return true. Otherwise, return false.
    // Polyfill.io - We can skip all above steps because the === operator does it all for us.
    return x === y;
  } // _ESAbstract.ToBoolean
  // 7.1.2. ToBoolean ( argument )
  // The abstract operation ToBoolean converts argument to a value of type Boolean according to Table 9:

  /*
  --------------------------------------------------------------------------------------------------------------
  | Argument Type | Result                                                                                     |
  --------------------------------------------------------------------------------------------------------------
  | Undefined     | Return false.                                                                              |
  | Null          | Return false.                                                                              |
  | Boolean       | Return argument.                                                                           |
  | Number        | If argument is +0, -0, or NaN, return false; otherwise return true.                        |
  | String        | If argument is the empty String (its length is zero), return false; otherwise return true. |
  | Symbol        | Return true.                                                                               |
  | Object        | Return true.                                                                               |
  --------------------------------------------------------------------------------------------------------------
  */


  function ToBoolean(argument) {
    // eslint-disable-line no-unused-vars
    return Boolean(argument);
  } // _ESAbstract.ToInteger
  // 7.1.4. ToInteger ( argument )


  function ToInteger(argument) {
    // eslint-disable-line no-unused-vars
    // 1. Let number be ? ToNumber(argument).
    var number = Number(argument); // 2. If number is NaN, return +0.

    if (isNaN(number)) {
      return 0;
    } // 3. If number is +0, -0, +∞, or -∞, return number.


    if (1 / number === Infinity || 1 / number === -Infinity || number === Infinity || number === -Infinity) {
      return number;
    } // 4. Return the number value that is the same sign as number and whose magnitude is floor(abs(number)).


    return (number < 0 ? -1 : 1) * Math.floor(Math.abs(number));
  } // _ESAbstract.ToLength

  /* global ToInteger */
  // 7.1.15. ToLength ( argument )


  function ToLength(argument) {
    // eslint-disable-line no-unused-vars
    // 1. Let len be ? ToInteger(argument).
    var len = ToInteger(argument); // 2. If len ≤ +0, return +0.

    if (len <= 0) {
      return 0;
    } // 3. Return min(len, 253-1).


    return Math.min(len, Math.pow(2, 53) - 1);
  } // _ESAbstract.ToObject
  // 7.1.13 ToObject ( argument )
  // The abstract operation ToObject converts argument to a value of type Object according to Table 12:
  // Table 12: ToObject Conversions

  /*
  |----------------------------------------------------------------------------------------------------------------------------------------------------|
  | Argument Type | Result                                                                                                                             |
  |----------------------------------------------------------------------------------------------------------------------------------------------------|
  | Undefined     | Throw a TypeError exception.                                                                                                       |
  | Null          | Throw a TypeError exception.                                                                                                       |
  | Boolean       | Return a new Boolean object whose [[BooleanData]] internal slot is set to argument. See 19.3 for a description of Boolean objects. |
  | Number        | Return a new Number object whose [[NumberData]] internal slot is set to argument. See 20.1 for a description of Number objects.    |
  | String        | Return a new String object whose [[StringData]] internal slot is set to argument. See 21.1 for a description of String objects.    |
  | Symbol        | Return a new Symbol object whose [[SymbolData]] internal slot is set to argument. See 19.4 for a description of Symbol objects.    |
  | Object        | Return argument.                                                                                                                   |
  |----------------------------------------------------------------------------------------------------------------------------------------------------|
  */


  function ToObject(argument) {
    // eslint-disable-line no-unused-vars
    if (argument === null || argument === undefined) {
      throw TypeError();
    }

    return Object(argument);
  } // _ESAbstract.GetV

  /* global ToObject */
  // 7.3.2 GetV (V, P)


  function GetV(v, p) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: IsPropertyKey(P) is true.
    // 2. Let O be ? ToObject(V).
    var o = ToObject(v); // 3. Return ? O.[[Get]](P, V).

    return o[p];
  } // _ESAbstract.GetMethod

  /* global GetV, IsCallable */
  // 7.3.9. GetMethod ( V, P )


  function GetMethod(V, P) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: IsPropertyKey(P) is true.
    // 2. Let func be ? GetV(V, P).
    var func = GetV(V, P); // 3. If func is either undefined or null, return undefined.

    if (func === null || func === undefined) {
      return undefined;
    } // 4. If IsCallable(func) is false, throw a TypeError exception.


    if (IsCallable(func) === false) {
      throw new TypeError('Method not callable: ' + P);
    } // 5. Return func.


    return func;
  } // _ESAbstract.Type
  // "Type(x)" is used as shorthand for "the type of x"...


  function Type(x) {
    // eslint-disable-line no-unused-vars
    switch (_typeof(x)) {
      case 'undefined':
        return 'undefined';

      case 'boolean':
        return 'boolean';

      case 'number':
        return 'number';

      case 'string':
        return 'string';

      case 'symbol':
        return 'symbol';

      default:
        // typeof null is 'object'
        if (x === null) return 'null';
        return 'object';
    }
  } // _ESAbstract.GetPrototypeFromConstructor

  /* global Get, Type */
  // 9.1.14. GetPrototypeFromConstructor ( constructor, intrinsicDefaultProto )


  function GetPrototypeFromConstructor(constructor, intrinsicDefaultProto) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: intrinsicDefaultProto is a String value that is this specification's name of an intrinsic object. The corresponding object must be an intrinsic that is intended to be used as the [[Prototype]] value of an object.
    // 2. Assert: IsCallable(constructor) is true.
    // 3. Let proto be ? Get(constructor, "prototype").
    var proto = Get(constructor, "prototype"); // 4. If Type(proto) is not Object, then

    if (Type(proto) !== 'object') {
      // a. Let realm be ? GetFunctionRealm(constructor).
      // b. Set proto to realm's intrinsic object named intrinsicDefaultProto.
      proto = intrinsicDefaultProto;
    } // 5. Return proto.


    return proto;
  } // _ESAbstract.IsConstructor

  /* global Type */
  // 7.2.4. IsConstructor ( argument )


  function IsConstructor(argument) {
    // eslint-disable-line no-unused-vars
    // 1. If Type(argument) is not Object, return false.
    if (Type(argument) !== 'object') {
      return false;
    } // 2. If argument has a [[Construct]] internal method, return true.
    // 3. Return false.
    // Polyfill.io - `new argument` is the only way  to truly test if a function is a constructor.
    // We choose to not use`new argument` because the argument could have side effects when called.
    // Instead we check to see if the argument is a function and if it has a prototype.
    // Arrow functions do not have a [[Construct]] internal method, nor do they have a prototype.


    return typeof argument === 'function' && !!argument.prototype;
  } // _ESAbstract.IsRegExp

  /* global Type, Get, ToBoolean */
  // 7.2.8. IsRegExp ( argument )


  function IsRegExp(argument) {
    // eslint-disable-line no-unused-vars
    // 1. If Type(argument) is not Object, return false.
    if (Type(argument) !== 'object') {
      return false;
    } // 2. Let matcher be ? Get(argument, @@match).


    var matcher = 'Symbol' in this && 'match' in this.Symbol ? Get(argument, this.Symbol.match) : undefined; // 3. If matcher is not undefined, return ToBoolean(matcher).

    if (matcher !== undefined) {
      return ToBoolean(matcher);
    } // 4. If argument has a [[RegExpMatcher]] internal slot, return true.


    try {
      var lastIndex = argument.lastIndex;
      argument.lastIndex = 0;
      RegExp.prototype.exec.call(argument);
      return true;
    } catch (e) {} finally {
      argument.lastIndex = lastIndex;
    } // 5. Return false.


    return false;
  } // _ESAbstract.IteratorClose

  /* global GetMethod, Type, Call */
  // 7.4.6. IteratorClose ( iteratorRecord, completion )


  function IteratorClose(iteratorRecord, completion) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(iteratorRecord.[[Iterator]]) is Object.
    if (Type(iteratorRecord['[[Iterator]]']) !== 'object') {
      throw new Error(Object.prototype.toString.call(iteratorRecord['[[Iterator]]']) + 'is not an Object.');
    } // 2. Assert: completion is a Completion Record.
    // Polyfill.io - Ignoring this step as there is no way to check if something is a Completion Record in userland JavaScript.
    // 3. Let iterator be iteratorRecord.[[Iterator]].


    var iterator = iteratorRecord['[[Iterator]]']; // 4. Let return be ? GetMethod(iterator, "return").
    // Polyfill.io - We name it  returnMethod because return is a keyword and can not be used as an identifier (E.G. variable name, function name etc).

    var returnMethod = GetMethod(iterator, "return"); // 5. If return is undefined, return Completion(completion).

    if (returnMethod === undefined) {
      return completion;
    } // 6. Let innerResult be Call(return, iterator, « »).


    try {
      var innerResult = Call(returnMethod, iterator);
    } catch (error) {
      var innerException = error;
    } // 7. If completion.[[Type]] is throw, return Completion(completion).


    if (completion) {
      return completion;
    } // 8. If innerResult.[[Type]] is throw, return Completion(innerResult).


    if (innerException) {
      throw innerException;
    } // 9. If Type(innerResult.[[Value]]) is not Object, throw a TypeError exception.


    if (Type(innerResult) !== 'object') {
      throw new TypeError("Iterator's return method returned a non-object.");
    } // 10. Return Completion(completion).


    return completion;
  } // _ESAbstract.IteratorComplete

  /* global Type, ToBoolean, Get */
  // 7.4.3 IteratorComplete ( iterResult )


  function IteratorComplete(iterResult) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(iterResult) is Object.
    if (Type(iterResult) !== 'object') {
      throw new Error(Object.prototype.toString.call(iterResult) + 'is not an Object.');
    } // 2. Return ToBoolean(? Get(iterResult, "done")).


    return ToBoolean(Get(iterResult, "done"));
  } // _ESAbstract.IteratorNext

  /* global Call, Type */
  // 7.4.2. IteratorNext ( iteratorRecord [ , value ] )


  function IteratorNext(iteratorRecord
  /* [, value] */
  ) {
    // eslint-disable-line no-unused-vars
    // 1. If value is not present, then
    if (arguments.length < 2) {
      // a. Let result be ? Call(iteratorRecord.[[NextMethod]], iteratorRecord.[[Iterator]], « »).
      var result = Call(iteratorRecord['[[NextMethod]]'], iteratorRecord['[[Iterator]]']); // 2. Else,
    } else {
      // a. Let result be ? Call(iteratorRecord.[[NextMethod]], iteratorRecord.[[Iterator]], « value »).
      result = Call(iteratorRecord['[[NextMethod]]'], iteratorRecord['[[Iterator]]'], [arguments[1]]);
    } // 3. If Type(result) is not Object, throw a TypeError exception.


    if (Type(result) !== 'object') {
      throw new TypeError('bad iterator');
    } // 4. Return result.


    return result;
  } // _ESAbstract.IteratorStep

  /* global IteratorNext, IteratorComplete */
  // 7.4.5. IteratorStep ( iteratorRecord )


  function IteratorStep(iteratorRecord) {
    // eslint-disable-line no-unused-vars
    // 1. Let result be ? IteratorNext(iteratorRecord).
    var result = IteratorNext(iteratorRecord); // 2. Let done be ? IteratorComplete(result).

    var done = IteratorComplete(result); // 3. If done is true, return false.

    if (done === true) {
      return false;
    } // 4. Return result.


    return result;
  } // _ESAbstract.IteratorValue

  /* global Type, Get */
  // 7.4.4 IteratorValue ( iterResult )


  function IteratorValue(iterResult) {
    // eslint-disable-line no-unused-vars
    // Assert: Type(iterResult) is Object.
    if (Type(iterResult) !== 'object') {
      throw new Error(Object.prototype.toString.call(iterResult) + 'is not an Object.');
    } // Return ? Get(iterResult, "value").


    return Get(iterResult, "value");
  } // _ESAbstract.OrdinaryToPrimitive

  /* global Get, IsCallable, Call, Type */
  // 7.1.1.1. OrdinaryToPrimitive ( O, hint )


  function OrdinaryToPrimitive(O, hint) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(O) is Object.
    // 2. Assert: Type(hint) is String and its value is either "string" or "number".
    // 3. If hint is "string", then
    if (hint === 'string') {
      // a. Let methodNames be « "toString", "valueOf" ».
      var methodNames = ['toString', 'valueOf']; // 4. Else,
    } else {
      // a. Let methodNames be « "valueOf", "toString" ».
      methodNames = ['valueOf', 'toString'];
    } // 5. For each name in methodNames in List order, do


    for (var i = 0; i < methodNames.length; ++i) {
      var name = methodNames[i]; // a. Let method be ? Get(O, name).

      var method = Get(O, name); // b. If IsCallable(method) is true, then

      if (IsCallable(method)) {
        // i. Let result be ? Call(method, O).
        var result = Call(method, O); // ii. If Type(result) is not Object, return result.

        if (Type(result) !== 'object') {
          return result;
        }
      }
    } // 6. Throw a TypeError exception.


    throw new TypeError('Cannot convert to primitive.');
  } // _ESAbstract.SameValueZero

  /* global Type, SameValueNonNumber */
  // 7.2.11. SameValueZero ( x, y )


  function SameValueZero(x, y) {
    // eslint-disable-line no-unused-vars
    // 1. If Type(x) is different from Type(y), return false.
    if (Type(x) !== Type(y)) {
      return false;
    } // 2. If Type(x) is Number, then


    if (Type(x) === 'number') {
      // a. If x is NaN and y is NaN, return true.
      if (isNaN(x) && isNaN(y)) {
        return true;
      } // b. If x is +0 and y is -0, return true.


      if (1 / x === Infinity && 1 / y === -Infinity) {
        return true;
      } // c. If x is -0 and y is +0, return true.


      if (1 / x === -Infinity && 1 / y === Infinity) {
        return true;
      } // d. If x is the same Number value as y, return true.


      if (x === y) {
        return true;
      } // e. Return false.


      return false;
    } // 3. Return SameValueNonNumber(x, y).


    return SameValueNonNumber(x, y);
  } // _ESAbstract.ToPrimitive

  /* global Type, GetMethod, Call, OrdinaryToPrimitive */
  // 7.1.1. ToPrimitive ( input [ , PreferredType ] )


  function ToPrimitive(input
  /* [, PreferredType] */
  ) {
    // eslint-disable-line no-unused-vars
    var PreferredType = arguments.length > 1 ? arguments[1] : undefined; // 1. Assert: input is an ECMAScript language value.
    // 2. If Type(input) is Object, then

    if (Type(input) === 'object') {
      // a. If PreferredType is not present, let hint be "default".
      if (arguments.length < 2) {
        var hint = 'default'; // b. Else if PreferredType is hint String, let hint be "string".
      } else if (PreferredType === String) {
        hint = 'string'; // c. Else PreferredType is hint Number, let hint be "number".
      } else if (PreferredType === Number) {
        hint = 'number';
      } // d. Let exoticToPrim be ? GetMethod(input, @@toPrimitive).


      var exoticToPrim = typeof this.Symbol === 'function' && _typeof(this.Symbol.toPrimitive) === 'symbol' ? GetMethod(input, this.Symbol.toPrimitive) : undefined; // e. If exoticToPrim is not undefined, then

      if (exoticToPrim !== undefined) {
        // i. Let result be ? Call(exoticToPrim, input, « hint »).
        var result = Call(exoticToPrim, input, [hint]); // ii. If Type(result) is not Object, return result.

        if (Type(result) !== 'object') {
          return result;
        } // iii. Throw a TypeError exception.


        throw new TypeError('Cannot convert exotic object to primitive.');
      } // f. If hint is "default", set hint to "number".


      if (hint === 'default') {
        hint = 'number';
      } // g. Return ? OrdinaryToPrimitive(input, hint).


      return OrdinaryToPrimitive(input, hint);
    } // 3. Return input


    return input;
  } // _ESAbstract.ToString

  /* global Type, ToPrimitive */
  // 7.1.12. ToString ( argument )
  // The abstract operation ToString converts argument to a value of type String according to Table 11:
  // Table 11: ToString Conversions

  /*
  |---------------|--------------------------------------------------------|
  | Argument Type | Result                                                 |
  |---------------|--------------------------------------------------------|
  | Undefined     | Return "undefined".                                    |
  |---------------|--------------------------------------------------------|
  | Null	        | Return "null".                                         |
  |---------------|--------------------------------------------------------|
  | Boolean       | If argument is true, return "true".                    |
  |               | If argument is false, return "false".                  |
  |---------------|--------------------------------------------------------|
  | Number        | Return NumberToString(argument).                       |
  |---------------|--------------------------------------------------------|
  | String        | Return argument.                                       |
  |---------------|--------------------------------------------------------|
  | Symbol        | Throw a TypeError exception.                           |
  |---------------|--------------------------------------------------------|
  | Object        | Apply the following steps:                             |
  |               | Let primValue be ? ToPrimitive(argument, hint String). |
  |               | Return ? ToString(primValue).                          |
  |---------------|--------------------------------------------------------|
  */


  function ToString(argument) {
    // eslint-disable-line no-unused-vars
    switch (Type(argument)) {
      case 'symbol':
        throw new TypeError('Cannot convert a Symbol value to a string');
        break;

      case 'object':
        var primValue = ToPrimitive(argument, 'string');
        return ToString(primValue);

      default:
        return String(argument);
    }
  }

  if (!("Date" in this && "now" in this.Date && "getTime" in this.Date.prototype)) {
    // Date.now
    Date.now = function now() {
      return new Date().getTime();
    };
  }

  if (!("document" in this)) {
    // document
    if (typeof WorkerGlobalScope === "undefined" && typeof importScripts !== "function") {
      if (this.HTMLDocument) {
        // IE8
        // HTMLDocument is an extension of Document.  If the browser has HTMLDocument but not Document, the former will suffice as an alias for the latter.
        this.Document = this.HTMLDocument;
      } else {
        // Create an empty function to act as the missing constructor for the document object, attach the document object as its prototype.  The function needs to be anonymous else it is hoisted and causes the feature detect to prematurely pass, preventing the assignments below being made.
        this.Document = this.HTMLDocument = document.constructor = new Function('return function Document() {}')();
        this.Document.prototype = document;
      }
    }
  }

  if (!function () {
    var e = document.createElement("p"),
        t = !1;
    return e.innerHTML = "<section></section>", document.documentElement.appendChild(e), e.firstChild && ("getComputedStyle" in window ? t = "block" === getComputedStyle(e.firstChild).display : e.firstChild.currentStyle && (t = "block" === e.firstChild.currentStyle.display)), document.documentElement.removeChild(e), t;
  }()) {
    // ~html5-elements

    /**
    * @preserve HTML5 Shiv 3.7.3 | @afarkas @jdalton @jon_neal @rem | MIT/GPL2 Licensed
    */
    !function (a, b) {
      function c(a, b) {
        var c = a.createElement("p"),
            d = a.getElementsByTagName("head")[0] || a.documentElement;
        return c.innerHTML = "x<style>" + b + "</style>", d.insertBefore(c.lastChild, d.firstChild);
      }

      function d() {
        var a = t.elements;
        return "string" == typeof a ? a.split(" ") : a;
      }

      function e(a, b) {
        var c = t.elements;
        "string" != typeof c && (c = c.join(" ")), "string" != typeof a && (a = a.join(" ")), t.elements = c + " " + a, j(b);
      }

      function f(a) {
        var b = s[a[q]];
        return b || (b = {}, r++, a[q] = r, s[r] = b), b;
      }

      function g(a, c, d) {
        if (c || (c = b), l) return c.createElement(a);
        d || (d = f(c));
        var e;
        return e = d.cache[a] ? d.cache[a].cloneNode() : p.test(a) ? (d.cache[a] = d.createElem(a)).cloneNode() : d.createElem(a), !e.canHaveChildren || o.test(a) || e.tagUrn ? e : d.frag.appendChild(e);
      }

      function h(a, c) {
        if (a || (a = b), l) return a.createDocumentFragment();
        c = c || f(a);

        for (var e = c.frag.cloneNode(), g = 0, h = d(), i = h.length; i > g; g++) {
          e.createElement(h[g]);
        }

        return e;
      }

      function i(a, b) {
        b.cache || (b.cache = {}, b.createElem = a.createElement, b.createFrag = a.createDocumentFragment, b.frag = b.createFrag()), a.createElement = function (c) {
          return t.shivMethods ? g(c, a, b) : b.createElem(c);
        }, a.createDocumentFragment = Function("h,f", "return function(){var n=f.cloneNode(),c=n.createElement;h.shivMethods&&(" + d().join().replace(/[\w\-:]+/g, function (a) {
          return b.createElem(a), b.frag.createElement(a), 'c("' + a + '")';
        }) + ");return n}")(t, b.frag);
      }

      function j(a) {
        a || (a = b);
        var d = f(a);
        return !t.shivCSS || k || d.hasCSS || (d.hasCSS = !!c(a, "article,aside,dialog,figcaption,figure,footer,header,hgroup,main,nav,section{display:block}mark{background:#FF0;color:#000}template{display:none}")), l || i(a, d), a;
      }

      var k,
          l,
          m = "3.7.3-pre",
          n = a.html5 || {},
          o = /^<|^(?:button|map|select|textarea|object|iframe|option|optgroup)$/i,
          p = /^(?:a|b|code|div|fieldset|h1|h2|h3|h4|h5|h6|i|label|li|ol|p|q|span|strong|style|table|tbody|td|th|tr|ul)$/i,
          q = "_html5shiv",
          r = 0,
          s = {};
      !function () {
        try {
          var a = b.createElement("a");
          a.innerHTML = "<xyz></xyz>", k = "hidden" in a, l = 1 == a.childNodes.length || function () {
            b.createElement("a");
            var a = b.createDocumentFragment();
            return "undefined" == typeof a.cloneNode || "undefined" == typeof a.createDocumentFragment || "undefined" == typeof a.createElement;
          }();
        } catch (c) {
          k = !0, l = !0;
        }
      }();
      var t = {
        elements: n.elements || "abbr article aside audio bdi canvas data datalist details dialog figcaption figure footer header hgroup main mark meter nav output picture progress section summary template time video",
        version: m,
        shivCSS: n.shivCSS !== !1,
        supportsUnknownElements: l,
        shivMethods: n.shivMethods !== !1,
        type: "default",
        shivDocument: j,
        createElement: g,
        createDocumentFragment: h,
        addElements: e
      };
      a.html5 = t, j(b), "object" == (typeof module === "undefined" ? "undefined" : _typeof(module)) && module.exports && (module.exports = t);
    }("undefined" != typeof window ? window : this, document);
  }

  if (!("Element" in this && "HTMLElement" in this)) {
    // Element
    (function () {
      // IE8
      if (window.Element && !window.HTMLElement) {
        window.HTMLElement = window.Element;
        return;
      } // create Element constructor


      window.Element = window.HTMLElement = new Function('return function Element() {}')(); // generate sandboxed iframe

      var vbody = document.appendChild(document.createElement('body'));
      var frame = vbody.appendChild(document.createElement('iframe')); // use sandboxed iframe to replicate Element functionality

      var frameDocument = frame.contentWindow.document;
      var prototype = Element.prototype = frameDocument.appendChild(frameDocument.createElement('*'));
      var cache = {}; // polyfill Element.prototype on an element

      var shiv = function shiv(element, deep) {
        var childNodes = element.childNodes || [],
            index = -1,
            key,
            value,
            childNode;

        if (element.nodeType === 1 && element.constructor !== Element) {
          element.constructor = Element;

          for (key in cache) {
            value = cache[key];
            element[key] = value;
          }
        }

        while (childNode = deep && childNodes[++index]) {
          shiv(childNode, deep);
        }

        return element;
      };

      var elements = document.getElementsByTagName('*');
      var nativeCreateElement = document.createElement;
      var interval;
      var loopLimit = 100;
      prototype.attachEvent('onpropertychange', function (event) {
        var propertyName = event.propertyName,
            nonValue = !cache.hasOwnProperty(propertyName),
            newValue = prototype[propertyName],
            oldValue = cache[propertyName],
            index = -1,
            element;

        while (element = elements[++index]) {
          if (element.nodeType === 1) {
            if (nonValue || element[propertyName] === oldValue) {
              element[propertyName] = newValue;
            }
          }
        }

        cache[propertyName] = newValue;
      });
      prototype.constructor = Element;

      if (!prototype.hasAttribute) {
        // <Element>.hasAttribute
        prototype.hasAttribute = function hasAttribute(name) {
          return this.getAttribute(name) !== null;
        };
      } // Apply Element prototype to the pre-existing DOM as soon as the body element appears.


      function bodyCheck() {
        if (!loopLimit--) clearTimeout(interval);

        if (document.body && !document.body.prototype && /(complete|interactive)/.test(document.readyState)) {
          shiv(document, true);
          if (interval && document.body.prototype) clearTimeout(interval);
          return !!document.body.prototype;
        }

        return false;
      }

      if (!bodyCheck()) {
        document.onreadystatechange = bodyCheck;
        interval = setInterval(bodyCheck, 25);
      } // Apply to any new elements created after load


      document.createElement = function createElement(nodeName) {
        var element = nativeCreateElement(String(nodeName).toLowerCase());
        return shiv(element);
      }; // remove sandboxed iframe


      document.removeChild(vbody);
    })();
  }

  if (!("document" in this && "querySelector" in this.document)) {
    // document.querySelector
    (function () {
      var head = document.getElementsByTagName('head')[0];

      function getElementsByQuery(node, selector, one) {
        var generator = document.createElement('div'),
            id = 'qsa' + String(Math.random()).slice(3),
            style,
            elements;
        generator.innerHTML = 'x<style>' + selector + '{qsa:' + id + ';}';
        style = head.appendChild(generator.lastChild);
        elements = getElements(node, selector, one, id);
        head.removeChild(style);
        return one ? elements[0] : elements;
      }

      function getElements(node, selector, one, id) {
        var validNode = /1|9/.test(node.nodeType),
            childNodes = node.childNodes,
            elements = [],
            index = -1,
            childNode;

        if (validNode && node.currentStyle && node.currentStyle.qsa === id) {
          if (elements.push(node) && one) {
            return elements;
          }
        }

        while (childNode = childNodes[++index]) {
          elements = elements.concat(getElements(childNode, selector, one, id));

          if (one && elements.length) {
            return elements;
          }
        }

        return elements;
      }

      Document.prototype.querySelector = Element.prototype.querySelector = function querySelectorAll(selector) {
        return getElementsByQuery(this, selector, true);
      };

      Document.prototype.querySelectorAll = Element.prototype.querySelectorAll = function querySelectorAll(selector) {
        return getElementsByQuery(this, selector, false);
      };
    })();
  }

  if (!("document" in this && "matches" in document.documentElement)) {
    // Element.prototype.matches
    Element.prototype.matches = Element.prototype.webkitMatchesSelector || Element.prototype.oMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.mozMatchesSelector || function matches(selector) {
      var element = this;
      var elements = (element.document || element.ownerDocument).querySelectorAll(selector);
      var index = 0;

      while (elements[index] && elements[index] !== element) {
        ++index;
      }

      return !!elements[index];
    };
  }

  if (!("document" in this && "closest" in document.documentElement)) {
    // Element.prototype.closest
    Element.prototype.closest = function closest(selector) {
      var node = this;

      while (node) {
        if (node.matches(selector)) return node;else node = 'SVGElement' in window && node instanceof SVGElement ? node.parentNode : node.parentElement;
      }

      return null;
    };
  }

  if (!("HTMLPictureElement" in this || "picturefill" in this)) {
    // HTMLPictureElement

    /*! picturefill - v3.0.2 - 2016-02-12
     * https://scottjehl.github.io/picturefill/
     * Copyright (c) 2016 https://github.com/scottjehl/picturefill/blob/master/Authors.txt; Licensed MIT
     */
    !function (a) {
      var b = navigator.userAgent;
      a.HTMLPictureElement && /ecko/.test(b) && b.match(/rv\:(\d+)/) && RegExp.$1 < 45 && addEventListener("resize", function () {
        var b,
            c = document.createElement("source"),
            d = function d(a) {
          var b,
              d,
              e = a.parentNode;
          "PICTURE" === e.nodeName.toUpperCase() ? (b = c.cloneNode(), e.insertBefore(b, e.firstElementChild), setTimeout(function () {
            e.removeChild(b);
          })) : (!a._pfLastSize || a.offsetWidth > a._pfLastSize) && (a._pfLastSize = a.offsetWidth, d = a.sizes, a.sizes += ",100vw", setTimeout(function () {
            a.sizes = d;
          }));
        },
            e = function e() {
          var a,
              b = document.querySelectorAll("picture > img, img[srcset][sizes]");

          for (a = 0; a < b.length; a++) {
            d(b[a]);
          }
        },
            f = function f() {
          clearTimeout(b), b = setTimeout(e, 99);
        },
            g = a.matchMedia && matchMedia("(orientation: landscape)"),
            h = function h() {
          f(), g && g.addListener && g.addListener(f);
        };

        return c.srcset = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", /^[c|i]|d$/.test(document.readyState || "") ? h() : document.addEventListener("DOMContentLoaded", h), f;
      }());
    }(window), function (a, b, c) {
      "use strict";

      function d(a) {
        return " " === a || "	" === a || "\n" === a || "\f" === a || "\r" === a;
      }

      function e(b, c) {
        var d = new a.Image();
        return d.onerror = function () {
          A[b] = !1, ba();
        }, d.onload = function () {
          A[b] = 1 === d.width, ba();
        }, d.src = c, "pending";
      }

      function f() {
        M = !1, P = a.devicePixelRatio, N = {}, O = {}, s.DPR = P || 1, Q.width = Math.max(a.innerWidth || 0, z.clientWidth), Q.height = Math.max(a.innerHeight || 0, z.clientHeight), Q.vw = Q.width / 100, Q.vh = Q.height / 100, r = [Q.height, Q.width, P].join("-"), Q.em = s.getEmValue(), Q.rem = Q.em;
      }

      function g(a, b, c, d) {
        var e, f, g, h;
        return "saveData" === B.algorithm ? a > 2.7 ? h = c + 1 : (f = b - c, e = Math.pow(a - .6, 1.5), g = f * e, d && (g += .1 * e), h = a + g) : h = c > 1 ? Math.sqrt(a * b) : a, h > c;
      }

      function h(a) {
        var b,
            c = s.getSet(a),
            d = !1;
        "pending" !== c && (d = r, c && (b = s.setRes(c), s.applySetCandidate(b, a))), a[s.ns].evaled = d;
      }

      function i(a, b) {
        return a.res - b.res;
      }

      function j(a, b, c) {
        var d;
        return !c && b && (c = a[s.ns].sets, c = c && c[c.length - 1]), d = k(b, c), d && (b = s.makeUrl(b), a[s.ns].curSrc = b, a[s.ns].curCan = d, d.res || aa(d, d.set.sizes)), d;
      }

      function k(a, b) {
        var c, d, e;
        if (a && b) for (e = s.parseSet(b), a = s.makeUrl(a), c = 0; c < e.length; c++) {
          if (a === s.makeUrl(e[c].url)) {
            d = e[c];
            break;
          }
        }
        return d;
      }

      function l(a, b) {
        var c,
            d,
            e,
            f,
            g = a.getElementsByTagName("source");

        for (c = 0, d = g.length; d > c; c++) {
          e = g[c], e[s.ns] = !0, f = e.getAttribute("srcset"), f && b.push({
            srcset: f,
            media: e.getAttribute("media"),
            type: e.getAttribute("type"),
            sizes: e.getAttribute("sizes")
          });
        }
      }

      function m(a, b) {
        function c(b) {
          var c,
              d = b.exec(a.substring(m));
          return d ? (c = d[0], m += c.length, c) : void 0;
        }

        function e() {
          var a,
              c,
              d,
              e,
              f,
              i,
              j,
              k,
              l,
              m = !1,
              o = {};

          for (e = 0; e < h.length; e++) {
            f = h[e], i = f[f.length - 1], j = f.substring(0, f.length - 1), k = parseInt(j, 10), l = parseFloat(j), X.test(j) && "w" === i ? ((a || c) && (m = !0), 0 === k ? m = !0 : a = k) : Y.test(j) && "x" === i ? ((a || c || d) && (m = !0), 0 > l ? m = !0 : c = l) : X.test(j) && "h" === i ? ((d || c) && (m = !0), 0 === k ? m = !0 : d = k) : m = !0;
          }

          m || (o.url = g, a && (o.w = a), c && (o.d = c), d && (o.h = d), d || c || a || (o.d = 1), 1 === o.d && (b.has1x = !0), o.set = b, n.push(o));
        }

        function f() {
          for (c(T), i = "", j = "in descriptor";;) {
            if (k = a.charAt(m), "in descriptor" === j) {
              if (d(k)) i && (h.push(i), i = "", j = "after descriptor");else {
                if ("," === k) return m += 1, i && h.push(i), void e();
                if ("(" === k) i += k, j = "in parens";else {
                  if ("" === k) return i && h.push(i), void e();
                  i += k;
                }
              }
            } else if ("in parens" === j) {
              if (")" === k) i += k, j = "in descriptor";else {
                if ("" === k) return h.push(i), void e();
                i += k;
              }
            } else if ("after descriptor" === j) if (d(k)) ;else {
              if ("" === k) return void e();
              j = "in descriptor", m -= 1;
            }
            m += 1;
          }
        }

        for (var g, h, i, j, k, l = a.length, m = 0, n = [];;) {
          if (c(U), m >= l) return n;
          g = c(V), h = [], "," === g.slice(-1) ? (g = g.replace(W, ""), e()) : f();
        }
      }

      function n(a) {
        function b(a) {
          function b() {
            f && (g.push(f), f = "");
          }

          function c() {
            g[0] && (h.push(g), g = []);
          }

          for (var e, f = "", g = [], h = [], i = 0, j = 0, k = !1;;) {
            if (e = a.charAt(j), "" === e) return b(), c(), h;

            if (k) {
              if ("*" === e && "/" === a[j + 1]) {
                k = !1, j += 2, b();
                continue;
              }

              j += 1;
            } else {
              if (d(e)) {
                if (a.charAt(j - 1) && d(a.charAt(j - 1)) || !f) {
                  j += 1;
                  continue;
                }

                if (0 === i) {
                  b(), j += 1;
                  continue;
                }

                e = " ";
              } else if ("(" === e) i += 1;else if (")" === e) i -= 1;else {
                if ("," === e) {
                  b(), c(), j += 1;
                  continue;
                }

                if ("/" === e && "*" === a.charAt(j + 1)) {
                  k = !0, j += 2;
                  continue;
                }
              }

              f += e, j += 1;
            }
          }
        }

        function c(a) {
          return k.test(a) && parseFloat(a) >= 0 ? !0 : l.test(a) ? !0 : "0" === a || "-0" === a || "+0" === a ? !0 : !1;
        }

        var e,
            f,
            g,
            h,
            i,
            j,
            k = /^(?:[+-]?[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?(?:ch|cm|em|ex|in|mm|pc|pt|px|rem|vh|vmin|vmax|vw)$/i,
            l = /^calc\((?:[0-9a-z \.\+\-\*\/\(\)]+)\)$/i;

        for (f = b(a), g = f.length, e = 0; g > e; e++) {
          if (h = f[e], i = h[h.length - 1], c(i)) {
            if (j = i, h.pop(), 0 === h.length) return j;
            if (h = h.join(" "), s.matchesMedia(h)) return j;
          }
        }

        return "100vw";
      }

      b.createElement("picture");

      var o,
          p,
          q,
          r,
          s = {},
          t = !1,
          u = function u() {},
          v = b.createElement("img"),
          w = v.getAttribute,
          x = v.setAttribute,
          y = v.removeAttribute,
          z = b.documentElement,
          A = {},
          B = {
        algorithm: ""
      },
          C = "data-pfsrc",
          D = C + "set",
          E = navigator.userAgent,
          F = /rident/.test(E) || /ecko/.test(E) && E.match(/rv\:(\d+)/) && RegExp.$1 > 35,
          G = "currentSrc",
          H = /\s+\+?\d+(e\d+)?w/,
          I = /(\([^)]+\))?\s*(.+)/,
          J = a.picturefillCFG,
          K = "position:absolute;left:0;visibility:hidden;display:block;padding:0;border:none;font-size:1em;width:1em;overflow:hidden;clip:rect(0px, 0px, 0px, 0px)",
          L = "font-size:100%!important;",
          M = !0,
          N = {},
          O = {},
          P = a.devicePixelRatio,
          Q = {
        px: 1,
        "in": 96
      },
          R = b.createElement("a"),
          S = !1,
          T = /^[ \t\n\r\u000c]+/,
          U = /^[, \t\n\r\u000c]+/,
          V = /^[^ \t\n\r\u000c]+/,
          W = /[,]+$/,
          X = /^\d+$/,
          Y = /^-?(?:[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/,
          Z = function Z(a, b, c, d) {
        a.addEventListener ? a.addEventListener(b, c, d || !1) : a.attachEvent && a.attachEvent("on" + b, c);
      },
          $ = function $(a) {
        var b = {};
        return function (c) {
          return c in b || (b[c] = a(c)), b[c];
        };
      },
          _ = function () {
        var a = /^([\d\.]+)(em|vw|px)$/,
            b = function b() {
          for (var a = arguments, b = 0, c = a[0]; ++b in a;) {
            c = c.replace(a[b], a[++b]);
          }

          return c;
        },
            c = $(function (a) {
          return "return " + b((a || "").toLowerCase(), /\band\b/g, "&&", /,/g, "||", /min-([a-z-\s]+):/g, "e.$1>=", /max-([a-z-\s]+):/g, "e.$1<=", /calc([^)]+)/g, "($1)", /(\d+[\.]*[\d]*)([a-z]+)/g, "($1 * e.$2)", /^(?!(e.[a-z]|[0-9\.&=|><\+\-\*\(\)\/])).*/gi, "") + ";";
        });

        return function (b, d) {
          var e;
          if (!(b in N)) if (N[b] = !1, d && (e = b.match(a))) N[b] = e[1] * Q[e[2]];else try {
            N[b] = new Function("e", c(b))(Q);
          } catch (f) {}
          return N[b];
        };
      }(),
          aa = function aa(a, b) {
        return a.w ? (a.cWidth = s.calcListLength(b || "100vw"), a.res = a.w / a.cWidth) : a.res = a.d, a;
      },
          ba = function ba(a) {
        if (t) {
          var c,
              d,
              e,
              f = a || {};

          if (f.elements && 1 === f.elements.nodeType && ("IMG" === f.elements.nodeName.toUpperCase() ? f.elements = [f.elements] : (f.context = f.elements, f.elements = null)), c = f.elements || s.qsa(f.context || b, f.reevaluate || f.reselect ? s.sel : s.selShort), e = c.length) {
            for (s.setupRun(f), S = !0, d = 0; e > d; d++) {
              s.fillImg(c[d], f);
            }

            s.teardownRun(f);
          }
        }
      };

      o = a.console && console.warn ? function (a) {
        console.warn(a);
      } : u, G in v || (G = "src"), A["image/jpeg"] = !0, A["image/gif"] = !0, A["image/png"] = !0, A["image/svg+xml"] = b.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#Image", "1.1"), s.ns = ("pf" + new Date().getTime()).substr(0, 9), s.supSrcset = "srcset" in v, s.supSizes = "sizes" in v, s.supPicture = !!a.HTMLPictureElement, s.supSrcset && s.supPicture && !s.supSizes && !function (a) {
        v.srcset = "data:,a", a.src = "data:,a", s.supSrcset = v.complete === a.complete, s.supPicture = s.supSrcset && s.supPicture;
      }(b.createElement("img")), s.supSrcset && !s.supSizes ? !function () {
        var a = "data:image/gif;base64,R0lGODlhAgABAPAAAP///wAAACH5BAAAAAAALAAAAAACAAEAAAICBAoAOw==",
            c = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
            d = b.createElement("img"),
            e = function e() {
          var a = d.width;
          2 === a && (s.supSizes = !0), q = s.supSrcset && !s.supSizes, t = !0, setTimeout(ba);
        };

        d.onload = e, d.onerror = e, d.setAttribute("sizes", "9px"), d.srcset = c + " 1w," + a + " 9w", d.src = c;
      }() : t = !0, s.selShort = "picture>img,img[srcset]", s.sel = s.selShort, s.cfg = B, s.DPR = P || 1, s.u = Q, s.types = A, s.setSize = u, s.makeUrl = $(function (a) {
        return R.href = a, R.href;
      }), s.qsa = function (a, b) {
        return "querySelector" in a ? a.querySelectorAll(b) : [];
      }, s.matchesMedia = function () {
        return a.matchMedia && (matchMedia("(min-width: 0.1em)") || {}).matches ? s.matchesMedia = function (a) {
          return !a || matchMedia(a).matches;
        } : s.matchesMedia = s.mMQ, s.matchesMedia.apply(this, arguments);
      }, s.mMQ = function (a) {
        return a ? _(a) : !0;
      }, s.calcLength = function (a) {
        var b = _(a, !0) || !1;
        return 0 > b && (b = !1), b;
      }, s.supportsType = function (a) {
        return a ? A[a] : !0;
      }, s.parseSize = $(function (a) {
        var b = (a || "").match(I);
        return {
          media: b && b[1],
          length: b && b[2]
        };
      }), s.parseSet = function (a) {
        return a.cands || (a.cands = m(a.srcset, a)), a.cands;
      }, s.getEmValue = function () {
        var a;

        if (!p && (a = b.body)) {
          var c = b.createElement("div"),
              d = z.style.cssText,
              e = a.style.cssText;
          c.style.cssText = K, z.style.cssText = L, a.style.cssText = L, a.appendChild(c), p = c.offsetWidth, a.removeChild(c), p = parseFloat(p, 10), z.style.cssText = d, a.style.cssText = e;
        }

        return p || 16;
      }, s.calcListLength = function (a) {
        if (!(a in O) || B.uT) {
          var b = s.calcLength(n(a));
          O[a] = b ? b : Q.width;
        }

        return O[a];
      }, s.setRes = function (a) {
        var b;

        if (a) {
          b = s.parseSet(a);

          for (var c = 0, d = b.length; d > c; c++) {
            aa(b[c], a.sizes);
          }
        }

        return b;
      }, s.setRes.res = aa, s.applySetCandidate = function (a, b) {
        if (a.length) {
          var c,
              d,
              e,
              f,
              h,
              k,
              l,
              m,
              n,
              o = b[s.ns],
              p = s.DPR;
          if (k = o.curSrc || b[G], l = o.curCan || j(b, k, a[0].set), l && l.set === a[0].set && (n = F && !b.complete && l.res - .1 > p, n || (l.cached = !0, l.res >= p && (h = l))), !h) for (a.sort(i), f = a.length, h = a[f - 1], d = 0; f > d; d++) {
            if (c = a[d], c.res >= p) {
              e = d - 1, h = a[e] && (n || k !== s.makeUrl(c.url)) && g(a[e].res, c.res, p, a[e].cached) ? a[e] : c;
              break;
            }
          }
          h && (m = s.makeUrl(h.url), o.curSrc = m, o.curCan = h, m !== k && s.setSrc(b, h), s.setSize(b));
        }
      }, s.setSrc = function (a, b) {
        var c;
        a.src = b.url, "image/svg+xml" === b.set.type && (c = a.style.width, a.style.width = a.offsetWidth + 1 + "px", a.offsetWidth + 1 && (a.style.width = c));
      }, s.getSet = function (a) {
        var b,
            c,
            d,
            e = !1,
            f = a[s.ns].sets;

        for (b = 0; b < f.length && !e; b++) {
          if (c = f[b], c.srcset && s.matchesMedia(c.media) && (d = s.supportsType(c.type))) {
            "pending" === d && (c = d), e = c;
            break;
          }
        }

        return e;
      }, s.parseSets = function (a, b, d) {
        var e,
            f,
            g,
            h,
            i = b && "PICTURE" === b.nodeName.toUpperCase(),
            j = a[s.ns];
        (j.src === c || d.src) && (j.src = w.call(a, "src"), j.src ? x.call(a, C, j.src) : y.call(a, C)), (j.srcset === c || d.srcset || !s.supSrcset || a.srcset) && (e = w.call(a, "srcset"), j.srcset = e, h = !0), j.sets = [], i && (j.pic = !0, l(b, j.sets)), j.srcset ? (f = {
          srcset: j.srcset,
          sizes: w.call(a, "sizes")
        }, j.sets.push(f), g = (q || j.src) && H.test(j.srcset || ""), g || !j.src || k(j.src, f) || f.has1x || (f.srcset += ", " + j.src, f.cands.push({
          url: j.src,
          d: 1,
          set: f
        }))) : j.src && j.sets.push({
          srcset: j.src,
          sizes: null
        }), j.curCan = null, j.curSrc = c, j.supported = !(i || f && !s.supSrcset || g && !s.supSizes), h && s.supSrcset && !j.supported && (e ? (x.call(a, D, e), a.srcset = "") : y.call(a, D)), j.supported && !j.srcset && (!j.src && a.src || a.src !== s.makeUrl(j.src)) && (null === j.src ? a.removeAttribute("src") : a.src = j.src), j.parsed = !0;
      }, s.fillImg = function (a, b) {
        var c,
            d = b.reselect || b.reevaluate;
        a[s.ns] || (a[s.ns] = {}), c = a[s.ns], (d || c.evaled !== r) && ((!c.parsed || b.reevaluate) && s.parseSets(a, a.parentNode, b), c.supported ? c.evaled = r : h(a));
      }, s.setupRun = function () {
        (!S || M || P !== a.devicePixelRatio) && f();
      }, s.supPicture ? (ba = u, s.fillImg = u) : !function () {
        var c,
            d = a.attachEvent ? /d$|^c/ : /d$|^c|^i/,
            e = function e() {
          var a = b.readyState || "";
          f = setTimeout(e, "loading" === a ? 200 : 999), b.body && (s.fillImgs(), c = c || d.test(a), c && clearTimeout(f));
        },
            f = setTimeout(e, b.body ? 9 : 99),
            g = function g(a, b) {
          var c,
              d,
              e = function e() {
            var f = new Date() - d;
            b > f ? c = setTimeout(e, b - f) : (c = null, a());
          };

          return function () {
            d = new Date(), c || (c = setTimeout(e, b));
          };
        },
            h = z.clientHeight,
            i = function i() {
          M = Math.max(a.innerWidth || 0, z.clientWidth) !== Q.width || z.clientHeight !== h, h = z.clientHeight, M && s.fillImgs();
        };

        Z(a, "resize", g(i, 99)), Z(b, "readystatechange", e);
      }(), s.picturefill = ba, s.fillImgs = ba, s.teardownRun = u, ba._ = s, a.picturefillCFG = {
        pf: s,
        push: function push(a) {
          var b = a.shift();
          "function" == typeof s[b] ? s[b].apply(s, a) : (B[b] = a[0], S && s.fillImgs({
            reselect: !0
          }));
        }
      };

      for (; J && J.length;) {
        a.picturefillCFG.push(J.shift());
      }

      a.picturefill = ba, "object" == (typeof module === "undefined" ? "undefined" : _typeof(module)) && "object" == _typeof(module.exports) ? module.exports = ba : "function" == typeof define && define.amd && define("picturefill", function () {
        return ba;
      }), s.supPicture || (A["image/webp"] = e("image/webp", "data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA=="));
    }(window, document);
    /*! picturefill - v3.0.2 - 2016-02-12
    * https://scottjehl.github.io/picturefill/
    * Copyright (c) 2016 https://github.com/scottjehl/picturefill/blob/master/Authors.txt; Licensed MIT
    */

    !function (a) {
      "use strict";

      var b,
          c = 0,
          d = function d() {
        window.picturefill && a(window.picturefill), (window.picturefill || c > 9999) && clearInterval(b), c++;
      };

      b = setInterval(d, 8), d();
    }(function (a) {
      "use strict";

      var b = window.document,
          c = window.Element,
          d = window.MutationObserver,
          e = function e() {},
          f = {
        disconnect: e,
        take: e,
        observe: e,
        start: e,
        stop: e,
        connected: !1
      },
          g = /^loade|^c|^i/.test(b.readyState || ""),
          h = a._;

      if (h.mutationSupport = !1, h.observer = f, Object.keys && window.HTMLSourceElement && b.addEventListener) {
        var i,
            j,
            k,
            l,
            m = {
          src: 1,
          srcset: 1,
          sizes: 1,
          media: 1
        },
            n = Object.keys(m),
            o = {
          attributes: !0,
          childList: !0,
          subtree: !0,
          attributeFilter: n
        },
            p = c && c.prototype,
            q = {},
            r = function r(a, b) {
          q[a] = h[a], h[a] = b;
        };

        p && !p.matches && (p.matches = p.matchesSelector || p.mozMatchesSelector || p.webkitMatchesSelector || p.msMatchesSelector), p && p.matches && (i = function i(a, b) {
          return a.matches(b);
        }, h.mutationSupport = !(!Object.create || !Object.defineProperties)), h.mutationSupport && (f.observe = function () {
          k && (f.connected = !0, j && j.observe(b.documentElement, o));
        }, f.disconnect = function () {
          f.connected = !1, j && j.disconnect();
        }, f.take = function () {
          j ? h.onMutations(j.takeRecords()) : l && l.take();
        }, f.start = function () {
          k = !0, f.observe();
        }, f.stop = function () {
          k = !1, f.disconnect();
        }, r("setupRun", function () {
          return f.disconnect(), q.setupRun.apply(this, arguments);
        }), r("teardownRun", function () {
          var a = q.setupRun.apply(this, arguments);
          return f.observe(), a;
        }), r("setSrc", function () {
          var a,
              b = f.connected;
          return f.disconnect(), a = q.setSrc.apply(this, arguments), b && f.observe(), a;
        }), h.onMutations = function (a) {
          var b,
              c,
              d = [];

          for (b = 0, c = a.length; c > b; b++) {
            g && "childList" === a[b].type ? h.onSubtreeChange(a[b], d) : "attributes" === a[b].type && h.onAttrChange(a[b], d);
          }

          d.length && h.fillImgs({
            elements: d,
            reevaluate: !0
          });
        }, h.onSubtreeChange = function (a, b) {
          h.findAddedMutations(a.addedNodes, b), h.findRemovedMutations(a.removedNodes, a.target, b);
        }, h.findAddedMutations = function (a, b) {
          var c, d, e, f;

          for (c = 0, d = a.length; d > c; c++) {
            e = a[c], 1 === e.nodeType && (f = e.nodeName.toUpperCase(), "PICTURE" === f ? h.addToElements(e.getElementsByTagName("img")[0], b) : "IMG" === f && i(e, h.selShort) ? h.addToElements(e, b) : "SOURCE" === f ? h.addImgForSource(e, e.parentNode, b) : h.addToElements(h.qsa(e, h.selShort), b));
          }
        }, h.findRemovedMutations = function (a, b, c) {
          var d, e, f;

          for (d = 0, e = a.length; e > d; d++) {
            f = a[d], 1 === f.nodeType && "SOURCE" === f.nodeName.toUpperCase() && h.addImgForSource(f, b, c);
          }
        }, h.addImgForSource = function (a, b, c) {
          b && "PICTURE" !== (b.nodeName || "").toUpperCase() && (b = b.parentNode, b && "PICTURE" === (b.nodeName || "").toUpperCase() || (b = null)), b && h.addToElements(b.getElementsByTagName("img")[0], c);
        }, h.addToElements = function (a, b) {
          var c, d;
          if (a) if ("length" in a && !a.nodeType) for (c = 0, d = a.length; d > c; c++) {
            h.addToElements(a[c], b);
          } else a.parentNode && -1 === b.indexOf(a) && b.push(a);
        }, h.onAttrChange = function (a, b) {
          var c,
              d = a.target[h.ns];
          d || "srcset" !== a.attributeName || "IMG" !== (c = a.target.nodeName.toUpperCase()) ? d && (c || (c = a.target.nodeName.toUpperCase()), "IMG" === c ? (a.attributeName in d && (d[a.attributeName] = void 0), h.addToElements(a.target, b)) : "SOURCE" === c && h.addImgForSource(a.target, a.target.parentNode, b)) : h.addToElements(a.target, b);
        }, h.supPicture || (d && !h.testMutationEvents ? j = new d(h.onMutations) : (l = function () {
          var a = !1,
              b = [],
              c = window.setImmediate || window.setTimeout;
          return function (d) {
            a || (a = !0, l.take || (l.take = function () {
              b.length && (h.onMutations(b), b = []), a = !1;
            }), c(l.take)), b.push(d);
          };
        }(), b.documentElement.addEventListener("DOMNodeInserted", function (a) {
          f.connected && g && l({
            type: "childList",
            addedNodes: [a.target],
            removedNodes: []
          });
        }, !0), b.documentElement.addEventListener("DOMNodeRemoved", function (a) {
          f.connected && g && "SOURCE" === (a.target || {}).nodeName && l({
            type: "childList",
            addedNodes: [],
            removedNodes: [a.target],
            target: a.target.parentNode
          });
        }, !0), b.documentElement.addEventListener("DOMAttrModified", function (a) {
          f.connected && m[a.attrName] && l({
            type: "attributes",
            target: a.target,
            attributeName: a.attrName
          });
        }, !0)), window.HTMLImageElement && Object.defineProperties && !function () {
          var a = b.createElement("img"),
              c = [],
              d = a.getAttribute,
              e = a.setAttribute,
              f = {
            src: 1
          };
          h.supSrcset && !h.supSizes && (f.srcset = 1), Object.defineProperties(HTMLImageElement.prototype, {
            getAttribute: {
              value: function value(a) {
                var b;
                return f[a] && (b = this[h.ns]) && void 0 !== b[a] ? b[a] : d.apply(this, arguments);
              },
              writeable: !0,
              enumerable: !0,
              configurable: !0
            }
          }), h.supSrcset || c.push("srcset"), h.supSizes || c.push("sizes"), c.forEach(function (a) {
            Object.defineProperty(HTMLImageElement.prototype, a, {
              set: function set(b) {
                e.call(this, a, b);
              },
              get: function get() {
                return d.call(this, a) || "";
              },
              enumerable: !0,
              configurable: !0
            });
          }), "currentSrc" in a || !function () {
            var a,
                c = function c(a, b) {
              null == b && (b = a.src || ""), Object.defineProperty(a, "pfCurrentSrc", {
                value: b,
                writable: !0
              });
            },
                d = c;

            h.supSrcset && window.devicePixelRatio && (a = function a(_a, b) {
              var c = _a.d || _a.w || _a.res,
                  d = b.d || b.w || b.res;
              return c - d;
            }, c = function c(b) {
              var c,
                  e,
                  f,
                  g,
                  i = b[h.ns];

              if (i && i.supported && i.srcset && i.sets && (e = h.parseSet(i.sets[0])) && e.sort) {
                for (e.sort(a), f = e.length, g = e[f - 1], c = 0; f > c; c++) {
                  if (e[c].d >= window.devicePixelRatio) {
                    g = e[c];
                    break;
                  }
                }

                g && (g = h.makeUrl(g.url));
              }

              d(b, g);
            }), b.addEventListener("load", function (a) {
              "IMG" === a.target.nodeName.toUpperCase() && c(a.target);
            }, !0), Object.defineProperty(HTMLImageElement.prototype, "currentSrc", {
              set: function set() {
                window.console && console.warn && console.warn("currentSrc can't be set on img element");
              },
              get: function get() {
                return this.complete && c(this), this.src || this.srcset ? this.pfCurrentSrc || "" : "";
              },
              enumerable: !0,
              configurable: !0
            });
          }(), !window.HTMLSourceElement || "srcset" in b.createElement("source") || ["srcset", "sizes"].forEach(function (a) {
            Object.defineProperty(window.HTMLSourceElement.prototype, a, {
              set: function set(b) {
                this.setAttribute(a, b);
              },
              get: function get() {
                return this.getAttribute(a) || "";
              },
              enumerable: !0,
              configurable: !0
            });
          });
        }(), f.start()), g || b.addEventListener("DOMContentLoaded", function () {
          g = !0;
        }));
      }
    });
  }

  if (!("defineProperty" in Object && function () {
    try {
      var e = {};
      return Object.defineProperty(e, "test", {
        value: 42
      }), !0;
    } catch (t) {
      return !1;
    }
  }())) {
    // Object.defineProperty
    (function (nativeDefineProperty) {
      var supportsAccessors = Object.prototype.hasOwnProperty('__defineGetter__');
      var ERR_ACCESSORS_NOT_SUPPORTED = 'Getters & setters cannot be defined on this javascript engine';
      var ERR_VALUE_ACCESSORS = 'A property cannot both have accessors and be writable or have a value'; // Polyfill.io - This does not use CreateMethodProperty because our CreateMethodProperty function uses Object.defineProperty.

      Object['defineProperty'] = function defineProperty(object, property, descriptor) {
        // Where native support exists, assume it
        if (nativeDefineProperty && (object === window || object === document || object === Element.prototype || object instanceof Element)) {
          return nativeDefineProperty(object, property, descriptor);
        }

        if (object === null || !(object instanceof Object || _typeof(object) === 'object')) {
          throw new TypeError('Object.defineProperty called on non-object');
        }

        if (!(descriptor instanceof Object)) {
          throw new TypeError('Property description must be an object');
        }

        var propertyString = String(property);
        var hasValueOrWritable = 'value' in descriptor || 'writable' in descriptor;

        var getterType = 'get' in descriptor && _typeof(descriptor.get);

        var setterType = 'set' in descriptor && _typeof(descriptor.set); // handle descriptor.get


        if (getterType) {
          if (getterType !== 'function') {
            throw new TypeError('Getter must be a function');
          }

          if (!supportsAccessors) {
            throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
          }

          if (hasValueOrWritable) {
            throw new TypeError(ERR_VALUE_ACCESSORS);
          }

          Object.__defineGetter__.call(object, propertyString, descriptor.get);
        } else {
          object[propertyString] = descriptor.value;
        } // handle descriptor.set


        if (setterType) {
          if (setterType !== 'function') {
            throw new TypeError('Setter must be a function');
          }

          if (!supportsAccessors) {
            throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
          }

          if (hasValueOrWritable) {
            throw new TypeError(ERR_VALUE_ACCESSORS);
          }

          Object.__defineSetter__.call(object, propertyString, descriptor.set);
        } // OK to define value unconditionally - if a getter has been specified as well, an error would be thrown above


        if ('value' in descriptor) {
          object[propertyString] = descriptor.value;
        }

        return object;
      };
    })(Object.defineProperty);
  } // _DOMTokenList

  /*
  Copyright (c) 2016, John Gardner
  
  Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
  
  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
  */


  var _DOMTokenList = function () {
    // eslint-disable-line no-unused-vars
    var dpSupport = true;

    var defineGetter = function defineGetter(object, name, fn, configurable) {
      if (Object.defineProperty) Object.defineProperty(object, name, {
        configurable: false === dpSupport ? true : !!configurable,
        get: fn
      });else object.__defineGetter__(name, fn);
    };
    /** Ensure the browser allows Object.defineProperty to be used on native JavaScript objects. */


    try {
      defineGetter({}, "support");
    } catch (e) {
      dpSupport = false;
    }

    var _DOMTokenList = function _DOMTokenList(el, prop) {
      var that = this;
      var tokens = [];
      var tokenMap = {};
      var length = 0;
      var maxLength = 0;

      var addIndexGetter = function addIndexGetter(i) {
        defineGetter(that, i, function () {
          preop();
          return tokens[i];
        }, false);
      };

      var reindex = function reindex() {
        /** Define getter functions for array-like access to the tokenList's contents. */
        if (length >= maxLength) for (; maxLength < length; ++maxLength) {
          addIndexGetter(maxLength);
        }
      };
      /** Helper function called at the start of each class method. Internal use only. */


      var preop = function preop() {
        var error;
        var i;
        var args = arguments;
        var rSpace = /\s+/;
        /** Validate the token/s passed to an instance method, if any. */

        if (args.length) for (i = 0; i < args.length; ++i) {
          if (rSpace.test(args[i])) {
            error = new SyntaxError('String "' + args[i] + '" ' + "contains" + ' an invalid character');
            error.code = 5;
            error.name = "InvalidCharacterError";
            throw error;
          }
        }
        /** Split the new value apart by whitespace*/

        if (_typeof(el[prop]) === "object") {
          tokens = ("" + el[prop].baseVal).replace(/^\s+|\s+$/g, "").split(rSpace);
        } else {
          tokens = ("" + el[prop]).replace(/^\s+|\s+$/g, "").split(rSpace);
        }
        /** Avoid treating blank strings as single-item token lists */


        if ("" === tokens[0]) tokens = [];
        /** Repopulate the internal token lists */

        tokenMap = {};

        for (i = 0; i < tokens.length; ++i) {
          tokenMap[tokens[i]] = true;
        }

        length = tokens.length;
        reindex();
      };
      /** Populate our internal token list if the targeted attribute of the subject element isn't empty. */


      preop();
      /** Return the number of tokens in the underlying string. Read-only. */

      defineGetter(that, "length", function () {
        preop();
        return length;
      });
      /** Override the default toString/toLocaleString methods to return a space-delimited list of tokens when typecast. */

      that.toLocaleString = that.toString = function () {
        preop();
        return tokens.join(" ");
      };

      that.item = function (idx) {
        preop();
        return tokens[idx];
      };

      that.contains = function (token) {
        preop();
        return !!tokenMap[token];
      };

      that.add = function () {
        preop.apply(that, args = arguments);

        for (var args, token, i = 0, l = args.length; i < l; ++i) {
          token = args[i];

          if (!tokenMap[token]) {
            tokens.push(token);
            tokenMap[token] = true;
          }
        }
        /** Update the targeted attribute of the attached element if the token list's changed. */


        if (length !== tokens.length) {
          length = tokens.length >>> 0;

          if (_typeof(el[prop]) === "object") {
            el[prop].baseVal = tokens.join(" ");
          } else {
            el[prop] = tokens.join(" ");
          }

          reindex();
        }
      };

      that.remove = function () {
        preop.apply(that, args = arguments);
        /** Build a hash of token names to compare against when recollecting our token list. */

        for (var args, ignore = {}, i = 0, t = []; i < args.length; ++i) {
          ignore[args[i]] = true;
          delete tokenMap[args[i]];
        }
        /** Run through our tokens list and reassign only those that aren't defined in the hash declared above. */


        for (i = 0; i < tokens.length; ++i) {
          if (!ignore[tokens[i]]) t.push(tokens[i]);
        }

        tokens = t;
        length = t.length >>> 0;
        /** Update the targeted attribute of the attached element. */

        if (_typeof(el[prop]) === "object") {
          el[prop].baseVal = tokens.join(" ");
        } else {
          el[prop] = tokens.join(" ");
        }

        reindex();
      };

      that.toggle = function (token, force) {
        preop.apply(that, [token]);
        /** Token state's being forced. */

        if (undefined !== force) {
          if (force) {
            that.add(token);
            return true;
          } else {
            that.remove(token);
            return false;
          }
        }
        /** Token already exists in tokenList. Remove it, and return FALSE. */


        if (tokenMap[token]) {
          that.remove(token);
          return false;
        }
        /** Otherwise, add the token and return TRUE. */


        that.add(token);
        return true;
      };

      return that;
    };

    return _DOMTokenList;
  }();

  if (!("DOMTokenList" in this && function (s) {
    return !("classList" in s) || !s.classList.toggle("x", !1) && !s.className;
  }(document.createElement("x")))) {
    // DOMTokenList
    (function (global) {
      var nativeImpl = "DOMTokenList" in global && global.DOMTokenList;

      if (!nativeImpl || !!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg', 'svg') && !(document.createElementNS("http://www.w3.org/2000/svg", "svg").classList instanceof DOMTokenList)) {
        global.DOMTokenList = _DOMTokenList;
      } // Add second argument to native DOMTokenList.toggle() if necessary


      (function () {
        var e = document.createElement('span');
        if (!('classList' in e)) return;
        e.classList.toggle('x', false);
        if (!e.classList.contains('x')) return;

        e.classList.constructor.prototype.toggle = function toggle(token
        /*, force*/
        ) {
          var force = arguments[1];

          if (force === undefined) {
            var add = !this.contains(token);
            this[add ? 'add' : 'remove'](token);
            return add;
          }

          force = !!force;
          this[force ? 'add' : 'remove'](token);
          return force;
        };
      })(); // Add multiple arguments to native DOMTokenList.add() if necessary


      (function () {
        var e = document.createElement('span');
        if (!('classList' in e)) return;
        e.classList.add('a', 'b');
        if (e.classList.contains('b')) return;
        var native = e.classList.constructor.prototype.add;

        e.classList.constructor.prototype.add = function () {
          var args = arguments;
          var l = arguments.length;

          for (var i = 0; i < l; i++) {
            native.call(this, args[i]);
          }
        };
      })(); // Add multiple arguments to native DOMTokenList.remove() if necessary


      (function () {
        var e = document.createElement('span');
        if (!('classList' in e)) return;
        e.classList.add('a');
        e.classList.add('b');
        e.classList.remove('a', 'b');
        if (!e.classList.contains('b')) return;
        var native = e.classList.constructor.prototype.remove;

        e.classList.constructor.prototype.remove = function () {
          var args = arguments;
          var l = arguments.length;

          for (var i = 0; i < l; i++) {
            native.call(this, args[i]);
          }
        };
      })();
    })(this);
  } // _ESAbstract.CreateDataProperty
  // 7.3.4. CreateDataProperty ( O, P, V )
  // NOTE
  // This abstract operation creates a property whose attributes are set to the same defaults used for properties created by the ECMAScript language assignment operator.
  // Normally, the property will not already exist. If it does exist and is not configurable or if O is not extensible, [[DefineOwnProperty]] will return false.


  function CreateDataProperty(O, P, V) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(O) is Object.
    // 2. Assert: IsPropertyKey(P) is true.
    // 3. Let newDesc be the PropertyDescriptor{ [[Value]]: V, [[Writable]]: true, [[Enumerable]]: true, [[Configurable]]: true }.
    var newDesc = {
      value: V,
      writable: true,
      enumerable: true,
      configurable: true
    }; // 4. Return ? O.[[DefineOwnProperty]](P, newDesc).

    try {
      Object.defineProperty(O, P, newDesc);
      return true;
    } catch (e) {
      return false;
    }
  } // _ESAbstract.CreateDataPropertyOrThrow

  /* global CreateDataProperty */
  // 7.3.6. CreateDataPropertyOrThrow ( O, P, V )


  function CreateDataPropertyOrThrow(O, P, V) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(O) is Object.
    // 2. Assert: IsPropertyKey(P) is true.
    // 3. Let success be ? CreateDataProperty(O, P, V).
    var success = CreateDataProperty(O, P, V); // 4. If success is false, throw a TypeError exception.

    if (!success) {
      throw new TypeError('Cannot assign value `' + Object.prototype.toString.call(V) + '` to property `' + Object.prototype.toString.call(P) + '` on object `' + Object.prototype.toString.call(O) + '`');
    } // 5. Return success.


    return success;
  } // _ESAbstract.CreateIterResultObject

  /* global Type, CreateDataProperty */
  // 7.4.7. CreateIterResultObject ( value, done )


  function CreateIterResultObject(value, done) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(done) is Boolean.
    if (Type(done) !== 'boolean') {
      throw new Error();
    } // 2. Let obj be ObjectCreate(%ObjectPrototype%).


    var obj = {}; // 3. Perform CreateDataProperty(obj, "value", value).

    CreateDataProperty(obj, "value", value); // 4. Perform CreateDataProperty(obj, "done", done).

    CreateDataProperty(obj, "done", done); // 5. Return obj.

    return obj;
  } // _ESAbstract.CreateMethodProperty
  // 7.3.5. CreateMethodProperty ( O, P, V )


  function CreateMethodProperty(O, P, V) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: Type(O) is Object.
    // 2. Assert: IsPropertyKey(P) is true.
    // 3. Let newDesc be the PropertyDescriptor{[[Value]]: V, [[Writable]]: true, [[Enumerable]]: false, [[Configurable]]: true}.
    var newDesc = {
      value: V,
      writable: true,
      enumerable: false,
      configurable: true
    }; // 4. Return ? O.[[DefineOwnProperty]](P, newDesc).

    Object.defineProperty(O, P, newDesc);
  }

  if (!("isArray" in Array)) {
    // Array.isArray

    /* global CreateMethodProperty, IsArray */
    // 22.1.2.2. Array.isArray ( arg )
    CreateMethodProperty(Array, 'isArray', function isArray(arg) {
      // 1. Return ? IsArray(arg).
      return IsArray(arg);
    });
  }

  if (!("forEach" in Array.prototype)) {
    // Array.prototype.forEach

    /* global Call, CreateMethodProperty, Get, HasProperty, IsCallable, ToLength, ToObject, ToString */
    // 22.1.3.10. Array.prototype.forEach ( callbackfn [ , thisArg ] )
    CreateMethodProperty(Array.prototype, 'forEach', function forEach(callbackfn
    /* [ , thisArg ] */
    ) {
      // 1. Let O be ? ToObject(this value).
      var O = ToObject(this); // Polyfill.io - If O is a String object, split it into an array in order to iterate correctly.
      // We will use arrayLike in place of O when we are iterating through the list.

      var arraylike = O instanceof String ? O.split('') : O; // 2. Let len be ? ToLength(? Get(O, "length")).

      var len = ToLength(Get(O, "length")); // 3. If IsCallable(callbackfn) is false, throw a TypeError exception.

      if (IsCallable(callbackfn) === false) {
        throw new TypeError(callbackfn + ' is not a function');
      } // 4. If thisArg is present, let T be thisArg; else let T be undefined.


      var T = arguments.length > 1 ? arguments[1] : undefined; // 5. Let k be 0.

      var k = 0; // 6. Repeat, while k < len

      while (k < len) {
        // a. Let Pk be ! ToString(k).
        var Pk = ToString(k); // b. Let kPresent be ? HasProperty(O, Pk).

        var kPresent = HasProperty(arraylike, Pk); // c. If kPresent is true, then

        if (kPresent) {
          // i. Let kValue be ? Get(O, Pk).
          var kValue = Get(arraylike, Pk); // ii. Perform ? Call(callbackfn, T, « kValue, k, O »).

          Call(callbackfn, T, [kValue, k, O]);
        } // d. Increase k by 1.


        k = k + 1;
      } // 7. Return undefined.


      return undefined;
    });
  }

  if (!("forEach" in NodeList.prototype)) {
    // NodeList.prototype.forEach
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  if (!("includes" in Array.prototype)) {
    // Array.prototype.includes

    /* global CreateMethodProperty, Get, SameValueZero, ToInteger, ToLength, ToObject, ToString */
    // 22.1.3.11. Array.prototype.includes ( searchElement [ , fromIndex ] )
    CreateMethodProperty(Array.prototype, 'includes', function includes(searchElement
    /* [ , fromIndex ] */
    ) {
      'use strict'; // 1. Let O be ? ToObject(this value).

      var O = ToObject(this); // 2. Let len be ? ToLength(? Get(O, "length")).

      var len = ToLength(Get(O, "length")); // 3. If len is 0, return false.

      if (len === 0) {
        return false;
      } // 4. Let n be ? ToInteger(fromIndex). (If fromIndex is undefined, this step produces the value 0.)


      var n = ToInteger(arguments[1]); // 5. If n ≥ 0, then

      if (n >= 0) {
        // a. Let k be n.
        var k = n; // 6. Else n < 0,
      } else {
        // a. Let k be len + n.
        k = len + n; // b. If k < 0, let k be 0.

        if (k < 0) {
          k = 0;
        }
      } // 7. Repeat, while k < len


      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        var elementK = Get(O, ToString(k)); // b. If SameValueZero(searchElement, elementK) is true, return true.

        if (SameValueZero(searchElement, elementK)) {
          return true;
        } // c. Increase k by 1.


        k = k + 1;
      } // 8. Return false.


      return false;
    });
  }

  if (!("indexOf" in Array.prototype)) {
    // Array.prototype.indexOf

    /* global CreateMethodProperty, Get, HasProperty, ToInteger, ToLength, ToObject, ToString */
    // 22.1.3.12. Array.prototype.indexOf ( searchElement [ , fromIndex ] )
    CreateMethodProperty(Array.prototype, 'indexOf', function indexOf(searchElement
    /* [ , fromIndex ] */
    ) {
      // 1. Let O be ? ToObject(this value).
      var O = ToObject(this); // 2. Let len be ? ToLength(? Get(O, "length")).

      var len = ToLength(Get(O, "length")); // 3. If len is 0, return -1.

      if (len === 0) {
        return -1;
      } // 4. Let n be ? ToInteger(fromIndex). (If fromIndex is undefined, this step produces the value 0.)


      var n = ToInteger(arguments[1]); // 5. If n ≥ len, return -1.

      if (n >= len) {
        return -1;
      } // 6. If n ≥ 0, then


      if (n >= 0) {
        // a. If n is -0, let k be +0; else let k be n.
        var k = n === -0 ? 0 : n; // 7. Else n < 0,
      } else {
        // a. Let k be len + n.
        var k = len + n; // b. If k < 0, let k be 0.

        if (k < 0) {
          k = 0;
        }
      } // 8. Repeat, while k < len


      while (k < len) {
        // a. Let kPresent be ? HasProperty(O, ! ToString(k)).
        var kPresent = HasProperty(O, ToString(k)); // b. If kPresent is true, then

        if (kPresent) {
          // i. Let elementK be ? Get(O, ! ToString(k)).
          var elementK = Get(O, ToString(k)); // ii. Let same be the result of performing Strict Equality Comparison searchElement === elementK.

          var same = searchElement === elementK; // iii. If same is true, return k.

          if (same) {
            return k;
          }
        } // c. Increase k by 1.


        k = k + 1;
      } // 9. Return -1.


      return -1;
    });
  }

  if (!("some" in Array.prototype)) {
    // Array.prototype.some

    /* global Call, CreateMethodProperty, Get, HasProperty, IsCallable, ToBoolean, ToLength, ToObject, ToString */
    // 22.1.3.24. Array.prototype.some ( callbackfn [ , thisArg ] )
    CreateMethodProperty(Array.prototype, 'some', function some(callbackfn
    /* [ , thisArg ] */
    ) {
      // 1. Let O be ? ToObject(this value).
      var O = ToObject(this); // 2. Let len be ? ToLength(? Get(O, "length")).

      var len = ToLength(Get(O, "length")); // 3. If IsCallable(callbackfn) is false, throw a TypeError exception.

      if (IsCallable(callbackfn) === false) {
        throw new TypeError(callbackfn + ' is not a function');
      } // 4. If thisArg is present, let T be thisArg; else let T be undefined.


      var T = arguments.length > 1 ? arguments[1] : undefined; // 5. Let k be 0.

      var k = 0; // 6. Repeat, while k < len

      while (k < len) {
        // a. Let Pk be ! ToString(k).
        var Pk = ToString(k); // b. Let kPresent be ? HasProperty(O, Pk).

        var kPresent = HasProperty(O, Pk); // c. If kPresent is true, then

        if (kPresent) {
          // i. Let kValue be ? Get(O, Pk).
          var kValue = Get(O, Pk); // ii. Let testResult be ToBoolean(? Call(callbackfn, T, « kValue, k, O »)).

          var testResult = ToBoolean(Call(callbackfn, T, [kValue, k, O])); // iii. If testResult is true, return true.

          if (testResult) {
            return true;
          }
        } // d. Increase k by 1.


        k = k + 1;
      } // 7. Return false.


      return false;
    });
  }

  if (!("bind" in Function.prototype)) {
    // Function.prototype.bind

    /* global CreateMethodProperty, IsCallable */
    // 19.2.3.2. Function.prototype.bind ( thisArg, ...args )
    // https://github.com/es-shims/es5-shim/blob/d6d7ff1b131c7ba14c798cafc598bb6780d37d3b/es5-shim.js#L182
    CreateMethodProperty(Function.prototype, 'bind', function bind(that) {
      // .length is 1
      // add necessary es5-shim utilities
      var $Array = Array;
      var $Object = Object;
      var ArrayPrototype = $Array.prototype;

      var Empty = function Empty() {};

      var array_slice = ArrayPrototype.slice;
      var array_concat = ArrayPrototype.concat;
      var array_push = ArrayPrototype.push;
      var max = Math.max; // /add necessary es5-shim utilities
      // 1. Let Target be the this value.

      var target = this; // 2. If IsCallable(Target) is false, throw a TypeError exception.

      if (!IsCallable(target)) {
        throw new TypeError('Function.prototype.bind called on incompatible ' + target);
      } // 3. Let A be a new (possibly empty) internal list of all of the
      //   argument values provided after thisArg (arg1, arg2 etc), in order.
      // XXX slicedArgs will stand in for "A" if used


      var args = array_slice.call(arguments, 1); // for normal call
      // 4. Let F be a new native ECMAScript object.
      // 11. Set the [[Prototype]] internal property of F to the standard
      //   built-in Function prototype object as specified in 15.3.3.1.
      // 12. Set the [[Call]] internal property of F as described in
      //   15.3.4.5.1.
      // 13. Set the [[Construct]] internal property of F as described in
      //   15.3.4.5.2.
      // 14. Set the [[HasInstance]] internal property of F as described in
      //   15.3.4.5.3.

      var bound;

      var binder = function binder() {
        if (this instanceof bound) {
          // 15.3.4.5.2 [[Construct]]
          // When the [[Construct]] internal method of a function object,
          // F that was created using the bind function is called with a
          // list of arguments ExtraArgs, the following steps are taken:
          // 1. Let target be the value of F's [[TargetFunction]]
          //   internal property.
          // 2. If target has no [[Construct]] internal method, a
          //   TypeError exception is thrown.
          // 3. Let boundArgs be the value of F's [[BoundArgs]] internal
          //   property.
          // 4. Let args be a new list containing the same values as the
          //   list boundArgs in the same order followed by the same
          //   values as the list ExtraArgs in the same order.
          // 5. Return the result of calling the [[Construct]] internal
          //   method of target providing args as the arguments.
          var result = target.apply(this, array_concat.call(args, array_slice.call(arguments)));

          if ($Object(result) === result) {
            return result;
          }

          return this;
        } else {
          // 15.3.4.5.1 [[Call]]
          // When the [[Call]] internal method of a function object, F,
          // which was created using the bind function is called with a
          // this value and a list of arguments ExtraArgs, the following
          // steps are taken:
          // 1. Let boundArgs be the value of F's [[BoundArgs]] internal
          //   property.
          // 2. Let boundThis be the value of F's [[BoundThis]] internal
          //   property.
          // 3. Let target be the value of F's [[TargetFunction]] internal
          //   property.
          // 4. Let args be a new list containing the same values as the
          //   list boundArgs in the same order followed by the same
          //   values as the list ExtraArgs in the same order.
          // 5. Return the result of calling the [[Call]] internal method
          //   of target providing boundThis as the this value and
          //   providing args as the arguments.
          // equiv: target.call(this, ...boundArgs, ...args)
          return target.apply(that, array_concat.call(args, array_slice.call(arguments)));
        }
      }; // 15. If the [[Class]] internal property of Target is "Function", then
      //     a. Let L be the length property of Target minus the length of A.
      //     b. Set the length own property of F to either 0 or L, whichever is
      //       larger.
      // 16. Else set the length own property of F to 0.


      var boundLength = max(0, target.length - args.length); // 17. Set the attributes of the length own property of F to the values
      //   specified in 15.3.5.1.

      var boundArgs = [];

      for (var i = 0; i < boundLength; i++) {
        array_push.call(boundArgs, '$' + i);
      } // XXX Build a dynamic function with desired amount of arguments is the only
      // way to set the length property of a function.
      // In environments where Content Security Policies enabled (Chrome extensions,
      // for ex.) all use of eval or Function costructor throws an exception.
      // However in all of these environments Function.prototype.bind exists
      // and so this code will never be executed.


      bound = Function('binder', 'return function (' + boundArgs.join(',') + '){ return binder.apply(this, arguments); }')(binder);

      if (target.prototype) {
        Empty.prototype = target.prototype;
        bound.prototype = new Empty(); // Clean up dangling references.

        Empty.prototype = null;
      } // TODO
      // 18. Set the [[Extensible]] internal property of F to true.
      // TODO
      // 19. Let thrower be the [[ThrowTypeError]] function Object (13.2.3).
      // 20. Call the [[DefineOwnProperty]] internal method of F with
      //   arguments "caller", PropertyDescriptor {[[Get]]: thrower, [[Set]]:
      //   thrower, [[Enumerable]]: false, [[Configurable]]: false}, and
      //   false.
      // 21. Call the [[DefineOwnProperty]] internal method of F with
      //   arguments "arguments", PropertyDescriptor {[[Get]]: thrower,
      //   [[Set]]: thrower, [[Enumerable]]: false, [[Configurable]]: false},
      //   and false.
      // TODO
      // NOTE Function objects created using Function.prototype.bind do not
      // have a prototype property or the [[Code]], [[FormalParameters]], and
      // [[Scope]] internal properties.
      // XXX can't delete prototype in pure-js.
      // 22. Return F.


      return bound;
    });
  }

  if (!("document" in this && "classList" in document.documentElement && "Element" in this && "classList" in Element.prototype && function () {
    var t = document.createElement("span");
    return t.classList.add("a", "b"), t.classList.contains("b");
  }())) {
    // Element.prototype.classList

    /*
    Copyright (c) 2016, John Gardner
    
    Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
    
    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
    */
    (function (global) {
      var dpSupport = true;

      var defineGetter = function defineGetter(object, name, fn, configurable) {
        if (Object.defineProperty) Object.defineProperty(object, name, {
          configurable: false === dpSupport ? true : !!configurable,
          get: fn
        });else object.__defineGetter__(name, fn);
      };
      /** Ensure the browser allows Object.defineProperty to be used on native JavaScript objects. */


      try {
        defineGetter({}, "support");
      } catch (e) {
        dpSupport = false;
      }
      /** Polyfills a property with a DOMTokenList */


      var addProp = function addProp(o, name, attr) {
        defineGetter(o.prototype, name, function () {
          var tokenList;
          var THIS = this,

          /** Prevent this from firing twice for some reason. What the hell, IE. */
          gibberishProperty = "__defineGetter__" + "DEFINE_PROPERTY" + name;
          if (THIS[gibberishProperty]) return tokenList;
          THIS[gibberishProperty] = true;
          /**
           * IE8 can't define properties on native JavaScript objects, so we'll use a dumb hack instead.
           *
           * What this is doing is creating a dummy element ("reflection") inside a detached phantom node ("mirror")
           * that serves as the target of Object.defineProperty instead. While we could simply use the subject HTML
           * element instead, this would conflict with element types which use indexed properties (such as forms and
           * select lists).
           */

          if (false === dpSupport) {
            var visage;
            var mirror = addProp.mirror || document.createElement("div");
            var reflections = mirror.childNodes;
            var l = reflections.length;

            for (var i = 0; i < l; ++i) {
              if (reflections[i]._R === THIS) {
                visage = reflections[i];
                break;
              }
            }
            /** Couldn't find an element's reflection inside the mirror. Materialise one. */


            visage || (visage = mirror.appendChild(document.createElement("div")));
            tokenList = DOMTokenList.call(visage, THIS, attr);
          } else tokenList = new DOMTokenList(THIS, attr);

          defineGetter(THIS, name, function () {
            return tokenList;
          });
          delete THIS[gibberishProperty];
          return tokenList;
        }, true);
      };

      addProp(global.Element, "classList", "className");
      addProp(global.HTMLElement, "classList", "className");
      addProp(global.HTMLLinkElement, "relList", "rel");
      addProp(global.HTMLAnchorElement, "relList", "rel");
      addProp(global.HTMLAreaElement, "relList", "rel");
    })(this);
  }

  if (!("freeze" in Object)) {
    // Object.freeze

    /* global CreateMethodProperty */
    // 19.1.2.6. Object.freeze ( O )
    CreateMethodProperty(Object, 'freeze', function freeze(O) {
      // This feature cannot be implemented fully as a polyfill.
      // We choose to silently fail which allows "securable" code
      // to "gracefully" degrade to working but insecure code.
      return O;
    });
  }

  if (!("getOwnPropertyDescriptor" in Object && "function" == typeof Object.getOwnPropertyDescriptor && function () {
    try {
      var t = {};
      return t.test = 0, 0 === Object.getOwnPropertyDescriptor(t, "test").value;
    } catch (e) {
      return !1;
    }
  }())) {
    // Object.getOwnPropertyDescriptor

    /* global CreateMethodProperty */
    (function () {
      var call = Function.prototype.call;
      var prototypeOfObject = Object.prototype;
      var owns = call.bind(prototypeOfObject.hasOwnProperty);
      var lookupGetter;
      var lookupSetter;
      var supportsAccessors;

      if (supportsAccessors = owns(prototypeOfObject, "__defineGetter__")) {
        lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
        lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
      }

      function doesGetOwnPropertyDescriptorWork(object) {
        try {
          object.sentinel = 0;
          return Object.getOwnPropertyDescriptor(object, "sentinel").value === 0;
        } catch (exception) {// returns falsy
        }
      } // check whether getOwnPropertyDescriptor works if it's given. Otherwise,
      // shim partially.


      if (Object.defineProperty) {
        var getOwnPropertyDescriptorWorksOnObject = doesGetOwnPropertyDescriptorWork({});
        var getOwnPropertyDescriptorWorksOnDom = typeof document == "undefined" || doesGetOwnPropertyDescriptorWork(document.createElement("div"));

        if (!getOwnPropertyDescriptorWorksOnDom || !getOwnPropertyDescriptorWorksOnObject) {
          var getOwnPropertyDescriptorFallback = Object.getOwnPropertyDescriptor;
        }
      }

      if (!Object.getOwnPropertyDescriptor || getOwnPropertyDescriptorFallback) {
        var ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a non-object: ";
        CreateMethodProperty(Object, 'getOwnPropertyDescriptor', function getOwnPropertyDescriptor(object, property) {
          if (_typeof(object) != "object" && typeof object != "function" || object === null) {
            throw new TypeError(ERR_NON_OBJECT + object);
          } // make a valiant attempt to use the real getOwnPropertyDescriptor
          // for I8's DOM elements.


          if (getOwnPropertyDescriptorFallback) {
            try {
              return getOwnPropertyDescriptorFallback.call(Object, object, property);
            } catch (exception) {// try the shim if the real one doesn't work
            }
          } // If object does not owns property return undefined immediately.


          if (!owns(object, property)) {
            return;
          } // If object has a property then it's for sure both `enumerable` and
          // `configurable`.


          var descriptor = {
            enumerable: true,
            configurable: true
          }; // If JS engine supports accessor properties then property may be a
          // getter or setter.

          if (supportsAccessors) {
            // Unfortunately `__lookupGetter__` will return a getter even
            // if object has own non getter property along with a same named
            // inherited getter. To avoid misbehavior we temporary remove
            // `__proto__` so that `__lookupGetter__` will return getter only
            // if it's owned by an object.
            var prototype = object.__proto__;
            object.__proto__ = prototypeOfObject;
            var getter = lookupGetter(object, property);
            var setter = lookupSetter(object, property); // Once we have getter and setter we can put values back.

            object.__proto__ = prototype;

            if (getter || setter) {
              if (getter) {
                descriptor.get = getter;
              }

              if (setter) {
                descriptor.set = setter;
              } // If it was accessor property we're done and return here
              // in order to avoid adding `value` to the descriptor.


              return descriptor;
            }
          } // If we got this far we know that object has an own property that is
          // not an accessor so we set it as a value and return descriptor.


          descriptor.value = object[property];
          descriptor.writable = true;
          return descriptor;
        });
      }
    })();
  }

  if (!function () {
    if (!document.documentElement.dataset) return !1;
    var t = document.createElement("div");
    return t.setAttribute("data-a-b", "c"), t.dataset && "c" == t.dataset.aB;
  }()) {
    // Element.prototype.dataset
    Object.defineProperty(Element.prototype, 'dataset', {
      get: function get() {
        var element = this;
        var attributes = this.attributes;
        var map = {};

        for (var i = 0; i < attributes.length; i++) {
          var attribute = attributes[i];

          if (attribute && attribute.name && /^data-\w[\w\-]*$/.test(attribute.name)) {
            var name = attribute.name;
            var value = attribute.value;
            var propName = name.substr(5).replace(/-./g, function (prop) {
              return prop.charAt(1).toUpperCase();
            });
            Object.defineProperty(map, propName, {
              enumerable: true,
              get: function () {
                return this.value;
              }.bind({
                value: value || ''
              }),
              set: function setter(name, value) {
                if (typeof value !== 'undefined') {
                  this.setAttribute(name, value);
                } else {
                  this.removeAttribute(name);
                }
              }.bind(element, name)
            });
          }
        }

        return map;
      }
    });
  }

  if (!("getOwnPropertyNames" in Object)) {
    // Object.getOwnPropertyNames

    /* global CreateMethodProperty */
    var toString = {}.toString;
    var split = ''.split;
    CreateMethodProperty(Object, 'getOwnPropertyNames', function getOwnPropertyNames(object) {
      var buffer = [];
      var key; // Non-enumerable properties cannot be discovered but can be checked for by name.
      // Define those used internally by JS to allow an incomplete solution

      var commonProps = ['length', "name", "arguments", "caller", "prototype", "observe", "unobserve"];

      if (typeof object === 'undefined' || object === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      } // Polyfill.io fallback for non-array-like strings which exist in some ES3 user-agents (IE 8)


      object = toString.call(object) == '[object String]' ? split.call(object, '') : Object(object); // Enumerable properties only

      for (key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          buffer.push(key);
        }
      } // Check for and add the common non-enumerable properties


      for (var i = 0, s = commonProps.length; i < s; i++) {
        if (commonProps[i] in object) buffer.push(commonProps[i]);
      }

      return buffer;
    });
  }

  if (!("getPrototypeOf" in Object)) {
    // Object.getPrototypeOf

    /* global CreateMethodProperty */
    // Based on: https://github.com/es-shims/es5-shim/blob/master/es5-sham.js
    // https://github.com/es-shims/es5-shim/issues#issue/2
    // http://ejohn.org/blog/objectgetprototypeof/
    // recommended by fschaefer on github
    //
    // sure, and webreflection says ^_^
    // ... this will nerever possibly return null
    // ... Opera Mini breaks here with infinite loops
    CreateMethodProperty(Object, 'getPrototypeOf', function getPrototypeOf(object) {
      if (object !== Object(object)) {
        throw new TypeError('Object.getPrototypeOf called on non-object');
      }

      var proto = object.__proto__;

      if (proto || proto === null) {
        return proto;
      } else if (typeof object.constructor == 'function' && object instanceof object.constructor) {
        return object.constructor.prototype;
      } else if (object instanceof Object) {
        return Object.prototype;
      } else {
        // Correctly return null for Objects created with `Object.create(null)`
        // (shammed or native) or `{ __proto__: null}`.  Also returns null for
        // cross-realm objects on browsers that lack `__proto__` support (like
        // IE <11), but that's the best we can do.
        return null;
      }
    });
  }

  if (!("keys" in Object && function () {
    return 2 === Object.keys(arguments).length;
  }(1, 2) && function () {
    try {
      return Object.keys(""), !0;
    } catch (t) {
      return !1;
    }
  }())) {
    // Object.keys

    /* global CreateMethodProperty */
    CreateMethodProperty(Object, "keys", function () {
      'use strict'; // modified from https://github.com/es-shims/object-keys

      var has = Object.prototype.hasOwnProperty;
      var toStr = Object.prototype.toString;
      var isEnumerable = Object.prototype.propertyIsEnumerable;
      var hasDontEnumBug = !isEnumerable.call({
        toString: null
      }, 'toString');
      var hasProtoEnumBug = isEnumerable.call(function () {}, 'prototype');
      var dontEnums = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'constructor'];

      var equalsConstructorPrototype = function equalsConstructorPrototype(o) {
        var ctor = o.constructor;
        return ctor && ctor.prototype === o;
      };

      var excludedKeys = {
        $console: true,
        $external: true,
        $frame: true,
        $frameElement: true,
        $frames: true,
        $innerHeight: true,
        $innerWidth: true,
        $outerHeight: true,
        $outerWidth: true,
        $pageXOffset: true,
        $pageYOffset: true,
        $parent: true,
        $scrollLeft: true,
        $scrollTop: true,
        $scrollX: true,
        $scrollY: true,
        $self: true,
        $webkitIndexedDB: true,
        $webkitStorageInfo: true,
        $window: true
      };

      var hasAutomationEqualityBug = function () {
        /* global window */
        if (typeof window === 'undefined') {
          return false;
        }

        for (var k in window) {
          try {
            if (!excludedKeys['$' + k] && has.call(window, k) && window[k] !== null && _typeof(window[k]) === 'object') {
              try {
                equalsConstructorPrototype(window[k]);
              } catch (e) {
                return true;
              }
            }
          } catch (e) {
            return true;
          }
        }

        return false;
      }();

      var equalsConstructorPrototypeIfNotBuggy = function equalsConstructorPrototypeIfNotBuggy(o) {
        /* global window */
        if (typeof window === 'undefined' || !hasAutomationEqualityBug) {
          return equalsConstructorPrototype(o);
        }

        try {
          return equalsConstructorPrototype(o);
        } catch (e) {
          return false;
        }
      };

      function isArgumentsObject(value) {
        var str = toStr.call(value);
        var isArgs = str === '[object Arguments]';

        if (!isArgs) {
          isArgs = str !== '[object Array]' && value !== null && _typeof(value) === 'object' && typeof value.length === 'number' && value.length >= 0 && toStr.call(value.callee) === '[object Function]';
        }

        return isArgs;
      }

      return function keys(object) {
        var isFunction = toStr.call(object) === '[object Function]';
        var isArguments = isArgumentsObject(object);
        var isString = toStr.call(object) === '[object String]';
        var theKeys = [];

        if (object === undefined || object === null) {
          throw new TypeError('Cannot convert undefined or null to object');
        }

        var skipProto = hasProtoEnumBug && isFunction;

        if (isString && object.length > 0 && !has.call(object, 0)) {
          for (var i = 0; i < object.length; ++i) {
            theKeys.push(String(i));
          }
        }

        if (isArguments && object.length > 0) {
          for (var j = 0; j < object.length; ++j) {
            theKeys.push(String(j));
          }
        } else {
          for (var name in object) {
            if (!(skipProto && name === 'prototype') && has.call(object, name)) {
              theKeys.push(String(name));
            }
          }
        }

        if (hasDontEnumBug) {
          var skipConstructor = equalsConstructorPrototypeIfNotBuggy(object);

          for (var k = 0; k < dontEnums.length; ++k) {
            if (!(skipConstructor && dontEnums[k] === 'constructor') && has.call(object, dontEnums[k])) {
              theKeys.push(dontEnums[k]);
            }
          }
        }

        return theKeys;
      };
    }());
  }

  if (!("defineProperties" in Object)) {
    // Object.defineProperties

    /* global CreateMethodProperty, Get, ToObject, Type */
    // 19.1.2.3. Object.defineProperties ( O, Properties )
    CreateMethodProperty(Object, 'defineProperties', function defineProperties(O, Properties) {
      // 1. If Type(O) is not Object, throw a TypeError exception.
      if (Type(O) !== 'object') {
        throw new TypeError('Object.defineProperties called on non-object');
      } // 2. Let props be ? ToObject(Properties).


      var props = ToObject(Properties); // 3. Let keys be ? props.[[OwnPropertyKeys]]().

      /*
      	Polyfill.io - This step in our polyfill is not complying with the specification.
      	[[OwnPropertyKeys]] is meant to return ALL keys, including non-enumerable and symbols.
      	TODO: When we have Reflect.ownKeys, use that instead as it is the userland equivalent of [[OwnPropertyKeys]].
      */

      var keys = Object.keys(props); // 4. Let descriptors be a new empty List.

      var descriptors = []; // 5. For each element nextKey of keys in List order, do

      for (var i = 0; i < keys.length; i++) {
        var nextKey = keys[i]; // a. Let propDesc be ? props.[[GetOwnProperty]](nextKey).

        var propDesc = Object.getOwnPropertyDescriptor(props, nextKey); // b. If propDesc is not undefined and propDesc.[[Enumerable]] is true, then

        if (propDesc !== undefined && propDesc.enumerable) {
          // i. Let descObj be ? Get(props, nextKey).
          var descObj = Get(props, nextKey); // ii. Let desc be ? ToPropertyDescriptor(descObj).
          // Polyfill.io - We skip this step because Object.defineProperty deals with it.
          // TODO: Implement this step?

          var desc = descObj; // iii. Append the pair (a two element List) consisting of nextKey and desc to the end of descriptors.

          descriptors.push([nextKey, desc]);
        }
      } // 6. For each pair from descriptors in list order, do


      for (var i = 0; i < descriptors.length; i++) {
        // a. Let P be the first element of pair.
        var P = descriptors[i][0]; // b. Let desc be the second element of pair.

        var desc = descriptors[i][1]; // c. Perform ? DefinePropertyOrThrow(O, P, desc).

        Object.defineProperty(O, P, desc);
      } // 7. Return O.


      return O;
    });
  }

  if (!("create" in Object)) {
    // Object.create

    /* global CreateMethodProperty, Type */
    CreateMethodProperty(Object, 'create', function create(O, properties) {
      // 1. If Type(O) is neither Object nor Null, throw a TypeError exception.
      if (Type(O) !== 'object' && Type(O) !== 'null') {
        throw new TypeError('Object prototype may only be an Object or null');
      } // 2. Let obj be ObjectCreate(O).


      var obj = new Function('e', 'function Object() {}Object.prototype=e;return new Object')(O);
      obj.constructor.prototype = O; // 3. If Properties is not undefined, then

      if (1 in arguments) {
        // a. Return ? ObjectDefineProperties(obj, Properties).
        return Object.defineProperties(obj, properties);
      }

      return obj;
    });
  } // _ESAbstract.GetIterator

  /* global GetMethod, Symbol, Call, Type, GetV */
  // 7.4.1. GetIterator ( obj [ , method ] )
  // The abstract operation GetIterator with argument obj and optional argument method performs the following steps:


  function GetIterator(obj
  /*, method */
  ) {
    // eslint-disable-line no-unused-vars
    // 1. If method is not present, then
    // a. Set method to ? GetMethod(obj, @@iterator).
    var method = arguments.length > 1 ? arguments[1] : GetMethod(obj, Symbol.iterator); // 2. Let iterator be ? Call(method, obj).

    var iterator = Call(method, obj); // 3. If Type(iterator) is not Object, throw a TypeError exception.

    if (Type(iterator) !== 'object') {
      throw new TypeError('bad iterator');
    } // 4. Let nextMethod be ? GetV(iterator, "next").


    var nextMethod = GetV(iterator, "next"); // 5. Let iteratorRecord be Record {[[Iterator]]: iterator, [[NextMethod]]: nextMethod, [[Done]]: false}.

    var iteratorRecord = Object.create(null);
    iteratorRecord['[[Iterator]]'] = iterator;
    iteratorRecord['[[NextMethod]]'] = nextMethod;
    iteratorRecord['[[Done]]'] = false; // 6. Return iteratorRecord.

    return iteratorRecord;
  } // _ESAbstract.OrdinaryCreateFromConstructor

  /* global GetPrototypeFromConstructor */
  // 9.1.13. OrdinaryCreateFromConstructor ( constructor, intrinsicDefaultProto [ , internalSlotsList ] )


  function OrdinaryCreateFromConstructor(constructor, intrinsicDefaultProto) {
    // eslint-disable-line no-unused-vars
    var internalSlotsList = arguments[2] || {}; // 1. Assert: intrinsicDefaultProto is a String value that is this specification's name of an intrinsic object.
    // The corresponding object must be an intrinsic that is intended to be used as the[[Prototype]] value of an object.
    // 2. Let proto be ? GetPrototypeFromConstructor(constructor, intrinsicDefaultProto).

    var proto = GetPrototypeFromConstructor(constructor, intrinsicDefaultProto); // 3. Return ObjectCreate(proto, internalSlotsList).
    // Polyfill.io - We do not pass internalSlotsList to Object.create because Object.create does not use the default ordinary object definitions specified in 9.1.

    var obj = Object.create(proto);

    for (var name in internalSlotsList) {
      if (Object.prototype.hasOwnProperty.call(internalSlotsList, name)) {
        Object.defineProperty(obj, name, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: internalSlotsList[name]
        });
      }
    }

    return obj;
  } // _ESAbstract.Construct

  /* global IsConstructor, OrdinaryCreateFromConstructor, Call */
  // 7.3.13. Construct ( F [ , argumentsList [ , newTarget ]] )


  function Construct(F
  /* [ , argumentsList [ , newTarget ]] */
  ) {
    // eslint-disable-line no-unused-vars
    // 1. If newTarget is not present, set newTarget to F.
    var newTarget = arguments.length > 2 ? arguments[2] : F; // 2. If argumentsList is not present, set argumentsList to a new empty List.

    var argumentsList = arguments.length > 1 ? arguments[1] : []; // 3. Assert: IsConstructor(F) is true.

    if (!IsConstructor(F)) {
      throw new TypeError('F must be a constructor.');
    } // 4. Assert: IsConstructor(newTarget) is true.


    if (!IsConstructor(newTarget)) {
      throw new TypeError('newTarget must be a constructor.');
    } // 5. Return ? F.[[Construct]](argumentsList, newTarget).
    // Polyfill.io - If newTarget is the same as F, it is equivalent to new F(...argumentsList).


    if (newTarget === F) {
      return new (Function.prototype.bind.apply(F, [null].concat(argumentsList)))();
    } else {
      // Polyfill.io - This is mimicking section 9.2.2 step 5.a.
      var obj = OrdinaryCreateFromConstructor(newTarget, Object.prototype);
      return Call(F, obj, argumentsList);
    }
  } // _ESAbstract.ArraySpeciesCreate

  /* global IsArray, ArrayCreate, Get, Type, IsConstructor, Construct */
  // 9.4.2.3. ArraySpeciesCreate ( originalArray, length )


  function ArraySpeciesCreate(originalArray, length) {
    // eslint-disable-line no-unused-vars
    // 1. Assert: length is an integer Number ≥ 0.
    // 2. If length is -0, set length to +0.
    if (1 / length === -Infinity) {
      length = 0;
    } // 3. Let isArray be ? IsArray(originalArray).


    var isArray = IsArray(originalArray); // 4. If isArray is false, return ? ArrayCreate(length).

    if (isArray === false) {
      return ArrayCreate(length);
    } // 5. Let C be ? Get(originalArray, "constructor").


    var C = Get(originalArray, 'constructor'); // Polyfill.io - We skip this section as not sure how to make a cross-realm normal Array, a same-realm Array.
    // 6. If IsConstructor(C) is true, then
    // if (IsConstructor(C)) {
    // a. Let thisRealm be the current Realm Record.
    // b. Let realmC be ? GetFunctionRealm(C).
    // c. If thisRealm and realmC are not the same Realm Record, then
    // i. If SameValue(C, realmC.[[Intrinsics]].[[%Array%]]) is true, set C to undefined.
    // }
    // 7. If Type(C) is Object, then

    if (Type(C) === 'object') {
      // a. Set C to ? Get(C, @@species).
      C = 'Symbol' in this && 'species' in this.Symbol ? Get(C, this.Symbol.species) : undefined; // b. If C is null, set C to undefined.

      if (C === null) {
        C = undefined;
      }
    } // 8. If C is undefined, return ? ArrayCreate(length).


    if (C === undefined) {
      return ArrayCreate(length);
    } // 9. If IsConstructor(C) is false, throw a TypeError exception.


    if (!IsConstructor(C)) {
      throw new TypeError('C must be a constructor');
    } // 10. Return ? Construct(C, « length »).


    return Construct(C, [length]);
  }

  if (!("filter" in Array.prototype)) {
    // Array.prototype.filter

    /* global CreateMethodProperty, ToObject, ToLength, Get, IsCallable, ArraySpeciesCreate, ToString, HasProperty, ToBoolean, Call, CreateDataPropertyOrThrow */
    // 22.1.3.7. Array.prototype.filter ( callbackfn [ , thisArg ] )
    CreateMethodProperty(Array.prototype, 'filter', function filter(callbackfn
    /* [ , thisArg ] */
    ) {
      // 1. Let O be ? ToObject(this value).
      var O = ToObject(this); // 2. Let len be ? ToLength(? Get(O, "length")).

      var len = ToLength(Get(O, "length")); // 3. If IsCallable(callbackfn) is false, throw a TypeError exception.

      if (IsCallable(callbackfn) === false) {
        throw new TypeError(callbackfn + ' is not a function');
      } // 4. If thisArg is present, let T be thisArg; else let T be undefined.


      var T = arguments.length > 1 ? arguments[1] : undefined; // 5. Let A be ? ArraySpeciesCreate(O, 0).

      var A = ArraySpeciesCreate(O, 0); // 6. Let k be 0.

      var k = 0; // 7. Let to be 0.

      var to = 0; // 8. Repeat, while k < len

      while (k < len) {
        // a. Let Pk be ! ToString(k).
        var Pk = ToString(k); // b. Let kPresent be ? HasProperty(O, Pk).

        var kPresent = HasProperty(O, Pk); // c. If kPresent is true, then

        if (kPresent) {
          // i. Let kValue be ? Get(O, Pk).
          var kValue = Get(O, Pk); // ii. Let selected be ToBoolean(? Call(callbackfn, T, « kValue, k, O »)).

          var selected = ToBoolean(Call(callbackfn, T, [kValue, k, O])); // iii. If selected is true, then

          if (selected) {
            // 1. Perform ? CreateDataPropertyOrThrow(A, ! ToString(to), kValue)
            CreateDataPropertyOrThrow(A, ToString(to), kValue); // 2. Increase to by 1.

            to = to + 1;
          }
        } // d. Increase k by 1.


        k = k + 1;
      } // 9. Return A.


      return A;
    });
  }

  if (!("map" in Array.prototype)) {
    // Array.prototype.map

    /* global ArraySpeciesCreate, Call, CreateDataPropertyOrThrow, CreateMethodProperty, Get, HasProperty, IsCallable, ToLength, ToObject, ToString */

    /* global CreateMethodProperty, ToObject, ToLength, Get, ArraySpeciesCreate, ToString, HasProperty, Call, CreateDataPropertyOrThrow */
    // 22.1.3.16. Array.prototype.map ( callbackfn [ , thisArg ] )
    CreateMethodProperty(Array.prototype, 'map', function map(callbackfn
    /* [ , thisArg ] */
    ) {
      // 1. Let O be ? ToObject(this value).
      var O = ToObject(this); // 2. Let len be ? ToLength(? Get(O, "length")).

      var len = ToLength(Get(O, "length")); // 3. If IsCallable(callbackfn) is false, throw a TypeError exception.

      if (IsCallable(callbackfn) === false) {
        throw new TypeError(callbackfn + ' is not a function');
      } // 4. If thisArg is present, let T be thisArg; else let T be undefined.


      var T = arguments.length > 1 ? arguments[1] : undefined; // 5. Let A be ? ArraySpeciesCreate(O, len).

      var A = ArraySpeciesCreate(O, len); // 6. Let k be 0.

      var k = 0; // 7. Repeat, while k < len

      while (k < len) {
        // a. Let Pk be ! ToString(k).
        var Pk = ToString(k); // b. Let kPresent be ? HasProperty(O, Pk).

        var kPresent = HasProperty(O, Pk); // c. If kPresent is true, then

        if (kPresent) {
          // i. Let kValue be ? Get(O, Pk).
          var kValue = Get(O, Pk); // ii. Let mappedValue be ? Call(callbackfn, T, « kValue, k, O »).

          var mappedValue = Call(callbackfn, T, [kValue, k, O]); // iii. Perform ? CreateDataPropertyOrThrow(A, Pk, mappedValue).

          CreateDataPropertyOrThrow(A, Pk, mappedValue);
        } // d. Increase k by 1.


        k = k + 1;
      } // 8. Return A.


      return A;
    });
  }

  if (!("performance" in this && "now" in this.performance)) {
    // performance.now
    (function (global) {
      var startTime = Date.now();

      if (!global.performance) {
        global.performance = {};
      }

      global.performance.now = function () {
        return Date.now() - startTime;
      };
    })(this);
  }

  if (!("Promise" in this)) {
    // Promise
    !function (n) {
      function t(r) {
        if (e[r]) return e[r].exports;
        var o = e[r] = {
          i: r,
          l: !1,
          exports: {}
        };
        return n[r].call(o.exports, o, o.exports, t), o.l = !0, o.exports;
      }

      var e = {};
      t.m = n, t.c = e, t.i = function (n) {
        return n;
      }, t.d = function (n, e, r) {
        t.o(n, e) || Object.defineProperty(n, e, {
          configurable: !1,
          enumerable: !0,
          get: r
        });
      }, t.n = function (n) {
        var e = n && n.__esModule ? function () {
          return n["default"];
        } : function () {
          return n;
        };
        return t.d(e, "a", e), e;
      }, t.o = function (n, t) {
        return Object.prototype.hasOwnProperty.call(n, t);
      }, t.p = "", t(t.s = 100);
    }({
      100:
      /*!***********************!*\
      !*** ./src/global.js ***!
      \***********************/
      function _(n, t, e) {
        (function (n) {
          var t = e(
          /*! ./yaku */
          5);

          try {
            n.Promise = t, window.Promise = t;
          } catch (r) {}
        }).call(t, e(
        /*! ./../~/webpack/buildin/global.js */
        2));
      },
      2:
      /*!***********************************!*\
      !*** (webpack)/buildin/global.js ***!
      \***********************************/
      function _(n, t) {
        var e;

        e = function () {
          return this;
        }();

        try {
          e = e || Function("return this")() || (0, eval)("this");
        } catch (r) {
          "object" == (typeof window === "undefined" ? "undefined" : _typeof(window)) && (e = window);
        }

        n.exports = e;
      },
      5:
      /*!*********************!*\
      !*** ./src/yaku.js ***!
      \*********************/
      function _(n, t, e) {
        (function (t) {
          !function () {
            "use strict";

            function e() {
              return rn[q][B] || D;
            }

            function r(n) {
              return n && "object" == _typeof(n);
            }

            function o(n) {
              return "function" == typeof n;
            }

            function i(n, t) {
              return n instanceof t;
            }

            function u(n) {
              return i(n, M);
            }

            function c(n, t, e) {
              if (!t(n)) throw h(e);
            }

            function f() {
              try {
                return R.apply(S, arguments);
              } catch (n) {
                return nn.e = n, nn;
              }
            }

            function s(n, t) {
              return R = n, S = t, f;
            }

            function a(n, t) {
              function e() {
                for (var e = 0; e < o;) {
                  t(r[e], r[e + 1]), r[e++] = P, r[e++] = P;
                }

                o = 0, r.length > n && (r.length = n);
              }

              var r = A(n),
                  o = 0;
              return function (n, t) {
                r[o++] = n, r[o++] = t, 2 === o && rn.nextTick(e);
              };
            }

            function l(n, t) {
              var e,
                  r,
                  u,
                  c,
                  f = 0;
              if (!n) throw h(Q);
              var a = n[rn[q][z]];
              if (o(a)) r = a.call(n);else {
                if (!o(n.next)) {
                  if (i(n, A)) {
                    for (e = n.length; f < e;) {
                      t(n[f], f++);
                    }

                    return f;
                  }

                  throw h(Q);
                }

                r = n;
              }

              for (; !(u = r.next()).done;) {
                if ((c = s(t)(u.value, f++)) === nn) throw o(r[G]) && r[G](), c.e;
              }

              return f;
            }

            function h(n) {
              return new TypeError(n);
            }

            function v(n) {
              return (n ? "" : V) + new M().stack;
            }

            function _(n, t) {
              var e = "on" + n.toLowerCase(),
                  r = O[e];
              H && H.listeners(n).length ? n === Z ? H.emit(n, t._v, t) : H.emit(n, t) : r ? r({
                reason: t._v,
                promise: t
              }) : rn[n](t._v, t);
            }

            function p(n) {
              return n && n._s;
            }

            function d(n) {
              if (p(n)) return new n(tn);
              var t, e, r;
              return t = new n(function (n, o) {
                if (t) throw h();
                e = n, r = o;
              }), c(e, o), c(r, o), t;
            }

            function w(n, t) {
              var e = !1;
              return function (r) {
                e || (e = !0, L && (n[N] = v(!0)), t === Y ? k(n, r) : x(n, t, r));
              };
            }

            function y(n, t, e, r) {
              return o(e) && (t._onFulfilled = e), o(r) && (n[J] && _(X, n), t._onRejected = r), L && (t._p = n), n[n._c++] = t, n._s !== $ && on(n, t), t;
            }

            function m(n) {
              if (n._umark) return !0;
              n._umark = !0;

              for (var t, e = 0, r = n._c; e < r;) {
                if (t = n[e++], t._onRejected || m(t)) return !0;
              }
            }

            function j(n, t) {
              function e(n) {
                return r.push(n.replace(/^\s+|\s+$/g, ""));
              }

              var r = [];
              return L && (t[N] && e(t[N]), function o(n) {
                n && K in n && (o(n._next), e(n[K] + ""), o(n._p));
              }(t)), (n && n.stack ? n.stack : n) + ("\n" + r.join("\n")).replace(en, "");
            }

            function g(n, t) {
              return n(t);
            }

            function x(n, t, e) {
              var r = 0,
                  o = n._c;
              if (n._s === $) for (n._s = t, n._v = e, t === U && (L && u(e) && (e.longStack = j(e, n)), un(n)); r < o;) {
                on(n, n[r++]);
              }
              return n;
            }

            function k(n, t) {
              if (t === n && t) return x(n, U, h(W)), n;

              if (t !== C && (o(t) || r(t))) {
                var e = s(b)(t);
                if (e === nn) return x(n, U, e.e), n;
                o(e) ? (L && p(t) && (n._next = t), p(t) ? T(n, t, e) : rn.nextTick(function () {
                  T(n, t, e);
                })) : x(n, Y, t);
              } else x(n, Y, t);

              return n;
            }

            function b(n) {
              return n.then;
            }

            function T(n, t, e) {
              var r = s(e, t)(function (e) {
                t && (t = C, k(n, e));
              }, function (e) {
                t && (t = C, x(n, U, e));
              });
              r === nn && t && (x(n, U, r.e), t = C);
            }

            var P,
                R,
                S,
                C = null,
                F = "object" == (typeof self === "undefined" ? "undefined" : _typeof(self)),
                O = F ? self : t,
                E = O.Promise,
                H = O.process,
                I = O.console,
                L = !1,
                A = Array,
                M = Error,
                U = 1,
                Y = 2,
                $ = 3,
                q = "Symbol",
                z = "iterator",
                B = "species",
                D = q + "(" + B + ")",
                G = "return",
                J = "_uh",
                K = "_pt",
                N = "_st",
                Q = "Invalid argument",
                V = "\nFrom previous ",
                W = "Chaining cycle detected for promise",
                X = "rejectionHandled",
                Z = "unhandledRejection",
                nn = {
              e: C
            },
                tn = function tn() {},
                en = /^.+\/node_modules\/yaku\/.+\n?/gm,
                rn = function rn(n) {
              var t,
                  e = this;
              if (!r(e) || e._s !== P) throw h("Invalid this");

              if (e._s = $, L && (e[K] = v()), n !== tn) {
                if (!o(n)) throw h(Q);
                t = s(n)(w(e, Y), w(e, U)), t === nn && x(e, U, t.e);
              }
            };

            rn["default"] = rn, function (n, t) {
              for (var e in t) {
                n[e] = t[e];
              }
            }(rn.prototype, {
              then: function then(n, t) {
                if (this._s === undefined) throw h();
                return y(this, d(rn.speciesConstructor(this, rn)), n, t);
              },
              "catch": function _catch(n) {
                return this.then(P, n);
              },
              "finally": function _finally(n) {
                return this.then(function (t) {
                  return rn.resolve(n()).then(function () {
                    return t;
                  });
                }, function (t) {
                  return rn.resolve(n()).then(function () {
                    throw t;
                  });
                });
              },
              _c: 0,
              _p: C
            }), rn.resolve = function (n) {
              return p(n) ? n : k(d(this), n);
            }, rn.reject = function (n) {
              return x(d(this), U, n);
            }, rn.race = function (n) {
              var t = this,
                  e = d(t),
                  r = function r(n) {
                x(e, Y, n);
              },
                  o = function o(n) {
                x(e, U, n);
              },
                  i = s(l)(n, function (n) {
                t.resolve(n).then(r, o);
              });

              return i === nn ? t.reject(i.e) : e;
            }, rn.all = function (n) {
              function t(n) {
                x(o, U, n);
              }

              var e,
                  r = this,
                  o = d(r),
                  i = [];
              return (e = s(l)(n, function (n, u) {
                r.resolve(n).then(function (n) {
                  i[u] = n, --e || x(o, Y, i);
                }, t);
              })) === nn ? r.reject(e.e) : (e || x(o, Y, []), o);
            }, rn.Symbol = O[q] || {}, s(function () {
              Object.defineProperty(rn, e(), {
                get: function get() {
                  return this;
                }
              });
            })(), rn.speciesConstructor = function (n, t) {
              var r = n.constructor;
              return r ? r[e()] || t : t;
            }, rn.unhandledRejection = function (n, t) {
              I && I.error("Uncaught (in promise)", L ? t.longStack : j(n, t));
            }, rn.rejectionHandled = tn, rn.enableLongStackTrace = function () {
              L = !0;
            }, rn.nextTick = F ? function (n) {
              E ? new E(function (n) {
                n();
              }).then(n) : setTimeout(n);
            } : H.nextTick, rn._s = 1;
            var on = a(999, function (n, t) {
              var e, r;
              return (r = n._s !== U ? t._onFulfilled : t._onRejected) === P ? void x(t, n._s, n._v) : (e = s(g)(r, n._v)) === nn ? void x(t, U, e.e) : void k(t, e);
            }),
                un = a(9, function (n) {
              m(n) || (n[J] = 1, _(Z, n));
            });

            try {
              n.exports = rn;
            } catch (cn) {
              O.Yaku = rn;
            }
          }();
        }).call(t, e(
        /*! ./../~/webpack/buildin/global.js */
        2));
      }
    });
  }

  if (!("includes" in String.prototype)) {
    // String.prototype.includes

    /* global CreateMethodProperty, IsRegExp, RequireObjectCoercible, ToInteger, ToString */
    // 21.1.3.7. String.prototype.includes ( searchString [ , position ] )
    CreateMethodProperty(String.prototype, 'includes', function includes(searchString
    /* [ , position ] */
    ) {
      'use strict';

      var position = arguments.length > 1 ? arguments[1] : undefined; // 1. Let O be ? RequireObjectCoercible(this value).

      var O = RequireObjectCoercible(this); // 2. Let S be ? ToString(O).

      var S = ToString(O); // 3. Let isRegExp be ? IsRegExp(searchString).

      var isRegExp = IsRegExp(searchString); // 4. If isRegExp is true, throw a TypeError exception.

      if (isRegExp) {
        throw new TypeError('First argument to String.prototype.includes must not be a regular expression');
      } // 5. Let searchStr be ? ToString(searchString).


      var searchStr = ToString(searchString); // 6. Let pos be ? ToInteger(position). (If position is undefined, this step produces the value 0.)

      var pos = ToInteger(position); // 7. Let len be the length of S.

      var len = S.length; // 8. Let start be min(max(pos, 0), len).

      var start = Math.min(Math.max(pos, 0), len); // 9. Let searchLen be the length of searchStr.
      // var searchLength = searchStr.length;
      // 10. If there exists any integer k not smaller than start such that k + searchLen is not greater than len, and for all nonnegative integers j less than searchLen, the code unit at index k+j within S is the same as the code unit at index j within searchStr, return true; but if there is no such integer k, return false.

      return String.prototype.indexOf.call(S, searchStr, start) !== -1;
    });
  }

  if (!("Symbol" in this && 0 === this.Symbol.length)) {
    // Symbol
    // A modification of https://github.com/WebReflection/get-own-property-symbols
    // (C) Andrea Giammarchi - MIT Licensed
    (function (Object, GOPS, global) {
      var setDescriptor;
      var id = 0;
      var random = '' + Math.random();
      var prefix = '__\x01symbol:';
      var prefixLength = prefix.length;
      var internalSymbol = '__\x01symbol@@' + random;
      var DP = 'defineProperty';
      var DPies = 'defineProperties';
      var GOPN = 'getOwnPropertyNames';
      var GOPD = 'getOwnPropertyDescriptor';
      var PIE = 'propertyIsEnumerable';
      var ObjectProto = Object.prototype;
      var hOP = ObjectProto.hasOwnProperty;
      var pIE = ObjectProto[PIE];
      var toString = ObjectProto.toString;
      var concat = Array.prototype.concat;
      var cachedWindowNames = (typeof window === "undefined" ? "undefined" : _typeof(window)) === 'object' ? Object.getOwnPropertyNames(window) : [];
      var nGOPN = Object[GOPN];

      var gOPN = function getOwnPropertyNames(obj) {
        if (toString.call(obj) === '[object Window]') {
          try {
            return nGOPN(obj);
          } catch (e) {
            // IE bug where layout engine calls userland gOPN for cross-domain `window` objects
            return concat.call([], cachedWindowNames);
          }
        }

        return nGOPN(obj);
      };

      var gOPD = Object[GOPD];
      var create = Object.create;
      var keys = Object.keys;
      var freeze = Object.freeze || Object;
      var defineProperty = Object[DP];
      var $defineProperties = Object[DPies];
      var descriptor = gOPD(Object, GOPN);

      var addInternalIfNeeded = function addInternalIfNeeded(o, uid, enumerable) {
        if (!hOP.call(o, internalSymbol)) {
          try {
            defineProperty(o, internalSymbol, {
              enumerable: false,
              configurable: false,
              writable: false,
              value: {}
            });
          } catch (e) {
            o[internalSymbol] = {};
          }
        }

        o[internalSymbol]['@@' + uid] = enumerable;
      };

      var createWithSymbols = function createWithSymbols(proto, descriptors) {
        var self = create(proto);
        gOPN(descriptors).forEach(function (key) {
          if (propertyIsEnumerable.call(descriptors, key)) {
            $defineProperty(self, key, descriptors[key]);
          }
        });
        return self;
      };

      var copyAsNonEnumerable = function copyAsNonEnumerable(descriptor) {
        var newDescriptor = create(descriptor);
        newDescriptor.enumerable = false;
        return newDescriptor;
      };

      var get = function get() {};

      var onlyNonSymbols = function onlyNonSymbols(name) {
        return name != internalSymbol && !hOP.call(source, name);
      };

      var onlySymbols = function onlySymbols(name) {
        return name != internalSymbol && hOP.call(source, name);
      };

      var propertyIsEnumerable = function propertyIsEnumerable(key) {
        var uid = '' + key;
        return onlySymbols(uid) ? hOP.call(this, uid) && this[internalSymbol]['@@' + uid] : pIE.call(this, key);
      };

      var setAndGetSymbol = function setAndGetSymbol(uid) {
        var descriptor = {
          enumerable: false,
          configurable: true,
          get: get,
          set: function set(value) {
            setDescriptor(this, uid, {
              enumerable: false,
              configurable: true,
              writable: true,
              value: value
            });
            addInternalIfNeeded(this, uid, true);
          }
        };

        try {
          defineProperty(ObjectProto, uid, descriptor);
        } catch (e) {
          ObjectProto[uid] = descriptor.value;
        }

        return freeze(source[uid] = defineProperty(Object(uid), 'constructor', sourceConstructor));
      };

      var _Symbol = function _Symbol2() {
        var description = arguments[0];

        if (this instanceof _Symbol2) {
          throw new TypeError('Symbol is not a constructor');
        }

        return setAndGetSymbol(prefix.concat(description || '', random, ++id));
      };

      var source = create(null);
      var sourceConstructor = {
        value: _Symbol
      };

      var sourceMap = function sourceMap(uid) {
        return source[uid];
      };

      var $defineProperty = function defineProp(o, key, descriptor) {
        var uid = '' + key;

        if (onlySymbols(uid)) {
          setDescriptor(o, uid, descriptor.enumerable ? copyAsNonEnumerable(descriptor) : descriptor);
          addInternalIfNeeded(o, uid, !!descriptor.enumerable);
        } else {
          defineProperty(o, key, descriptor);
        }

        return o;
      };

      var onlyInternalSymbols = function onlyInternalSymbols(obj) {
        return function (name) {
          return hOP.call(obj, internalSymbol) && hOP.call(obj[internalSymbol], '@@' + name);
        };
      };

      var $getOwnPropertySymbols = function getOwnPropertySymbols(o) {
        return gOPN(o).filter(o === ObjectProto ? onlyInternalSymbols(o) : onlySymbols).map(sourceMap);
      };

      descriptor.value = $defineProperty;
      defineProperty(Object, DP, descriptor);
      descriptor.value = $getOwnPropertySymbols;
      defineProperty(Object, GOPS, descriptor);

      descriptor.value = function getOwnPropertyNames(o) {
        return gOPN(o).filter(onlyNonSymbols);
      };

      defineProperty(Object, GOPN, descriptor);

      descriptor.value = function defineProperties(o, descriptors) {
        var symbols = $getOwnPropertySymbols(descriptors);

        if (symbols.length) {
          keys(descriptors).concat(symbols).forEach(function (uid) {
            if (propertyIsEnumerable.call(descriptors, uid)) {
              $defineProperty(o, uid, descriptors[uid]);
            }
          });
        } else {
          $defineProperties(o, descriptors);
        }

        return o;
      };

      defineProperty(Object, DPies, descriptor);
      descriptor.value = propertyIsEnumerable;
      defineProperty(ObjectProto, PIE, descriptor);
      descriptor.value = _Symbol;
      defineProperty(global, 'Symbol', descriptor); // defining `Symbol.for(key)`

      descriptor.value = function (key) {
        var uid = prefix.concat(prefix, key, random);
        return uid in ObjectProto ? source[uid] : setAndGetSymbol(uid);
      };

      defineProperty(_Symbol, 'for', descriptor); // defining `Symbol.keyFor(symbol)`

      descriptor.value = function (symbol) {
        if (onlyNonSymbols(symbol)) throw new TypeError(symbol + ' is not a symbol');
        return hOP.call(source, symbol) ? symbol.slice(prefixLength * 2, -random.length) : void 0;
      };

      defineProperty(_Symbol, 'keyFor', descriptor);

      descriptor.value = function getOwnPropertyDescriptor(o, key) {
        var descriptor = gOPD(o, key);

        if (descriptor && onlySymbols(key)) {
          descriptor.enumerable = propertyIsEnumerable.call(o, key);
        }

        return descriptor;
      };

      defineProperty(Object, GOPD, descriptor);

      descriptor.value = function (proto, descriptors) {
        return arguments.length === 1 || typeof descriptors === "undefined" ? create(proto) : createWithSymbols(proto, descriptors);
      };

      defineProperty(Object, 'create', descriptor);

      descriptor.value = function () {
        var str = toString.call(this);
        return str === '[object String]' && onlySymbols(this) ? '[object Symbol]' : str;
      };

      defineProperty(ObjectProto, 'toString', descriptor);

      setDescriptor = function setDescriptor(o, key, descriptor) {
        var protoDescriptor = gOPD(ObjectProto, key);
        delete ObjectProto[key];
        defineProperty(o, key, descriptor);

        if (o !== ObjectProto) {
          defineProperty(ObjectProto, key, protoDescriptor);
        }
      };
    })(Object, 'getOwnPropertySymbols', this);
  }

  if (!("Symbol" in this && "iterator" in this.Symbol)) {
    // Symbol.iterator

    /* global Symbol */
    Object.defineProperty(Symbol, 'iterator', {
      value: Symbol('iterator')
    });
  }

  if (!("Symbol" in this && "species" in this.Symbol)) {
    // Symbol.species

    /* global Symbol */
    Object.defineProperty(Symbol, 'species', {
      value: Symbol('species')
    });
  }

  if (!("Map" in this && function () {
    try {
      var t = new Map([[1, 1], [2, 2]]);
      return 0 === Map.length && 2 === t.size && "Symbol" in this && "iterator" in Symbol && "function" == typeof t[Symbol.iterator];
    } catch (n) {
      return !1;
    }
  }())) {
    // Map

    /* global CreateIterResultObject, CreateMethodProperty, GetIterator, IsCallable, IteratorClose, IteratorStep, IteratorValue, OrdinaryCreateFromConstructor, SameValueZero, Type, Symbol */
    (function (global) {
      var supportsGetters = function () {
        try {
          var a = {};
          Object.defineProperty(a, 't', {
            configurable: true,
            enumerable: false,
            get: function get() {
              return true;
            },
            set: undefined
          });
          return !!a.t;
        } catch (e) {
          return false;
        }
      }(); // Deleted map items mess with iterator pointers, so rather than removing them mark them as deleted. Can't use undefined or null since those both valid keys so use a private symbol.


      var undefMarker = Symbol('undef'); // 23.1.1.1 Map ( [ iterable ] )

      var Map = function Map()
      /* iterable */
      {
        // 1. If NewTarget is undefined, throw a TypeError exception.
        if (!(this instanceof Map)) {
          throw new TypeError('Constructor Map requires "new"');
        } // 2. Let map be ? OrdinaryCreateFromConstructor(NewTarget, "%MapPrototype%", « [[MapData]] »).


        var map = OrdinaryCreateFromConstructor(this, Map.prototype, {
          _keys: [],
          _values: [],
          _size: 0,
          _es6Map: true
        }); // 3. Set map.[[MapData]] to a new empty List.
        // Polyfill.io - This step was done as part of step two.
        // Some old engines do not support ES5 getters/setters.  Since Map only requires these for the size property, we can fall back to setting the size property statically each time the size of the map changes.

        if (!supportsGetters) {
          Object.defineProperty(map, 'size', {
            configurable: true,
            enumerable: false,
            writable: true,
            value: 0
          });
        } // 4. If iterable is not present, let iterable be undefined.


        var iterable = arguments.length > 0 ? arguments[0] : undefined; // 5. If iterable is either undefined or null, return map.

        if (iterable === null || iterable === undefined) {
          return map;
        } // 6. Let adder be ? Get(map, "set").


        var adder = map.set; // 7. If IsCallable(adder) is false, throw a TypeError exception.

        if (!IsCallable(adder)) {
          throw new TypeError("Map.prototype.set is not a function");
        } // 8. Let iteratorRecord be ? GetIterator(iterable).


        try {
          var iteratorRecord = GetIterator(iterable); // 9. Repeat,

          while (true) {
            // a. Let next be ? IteratorStep(iteratorRecord).
            var next = IteratorStep(iteratorRecord); // b. If next is false, return map.

            if (next === false) {
              return map;
            } // c. Let nextItem be ? IteratorValue(next).


            var nextItem = IteratorValue(next); // d. If Type(nextItem) is not Object, then

            if (Type(nextItem) !== 'object') {
              // i. Let error be Completion{[[Type]]: throw, [[Value]]: a newly created TypeError object, [[Target]]: empty}.
              try {
                throw new TypeError('Iterator value ' + nextItem + ' is not an entry object');
              } catch (error) {
                // ii. Return ? IteratorClose(iteratorRecord, error).
                return IteratorClose(iteratorRecord, error);
              }
            }

            try {
              // Polyfill.io - The try catch accounts for steps: f, h, and j.
              // e. Let k be Get(nextItem, "0").
              var k = nextItem[0]; // f. If k is an abrupt completion, return ? IteratorClose(iteratorRecord, k).
              // g. Let v be Get(nextItem, "1").

              var v = nextItem[1]; // h. If v is an abrupt completion, return ? IteratorClose(iteratorRecord, v).
              // i. Let status be Call(adder, map, « k.[[Value]], v.[[Value]] »).

              adder.call(map, k, v);
            } catch (e) {
              // j. If status is an abrupt completion, return ? IteratorClose(iteratorRecord, status).
              return IteratorClose(iteratorRecord, e);
            }
          }
        } catch (e) {
          // Polyfill.io - For user agents which do not have iteration methods on argument objects or arrays, we can special case those.
          if (Array.isArray(iterable) || Object.prototype.toString.call(iterable) === '[object Arguments]' || // IE 7 & IE 8 return '[object Object]' for the arguments object, we can detect by checking for the existence of the callee property
          !!iterable.callee) {
            var index;
            var length = iterable.length;

            for (index = 0; index < length; index++) {
              adder.call(map, iterable[index][0], iterable[index][1]);
            }
          }
        }

        return map;
      }; // 23.1.2.1. Map.prototype
      // The initial value of Map.prototype is the intrinsic object %MapPrototype%.
      // This property has the attributes { [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: false }.


      Object.defineProperty(Map, 'prototype', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: {}
      }); // 23.1.2.2 get Map [ @@species ]

      if (supportsGetters) {
        Object.defineProperty(Map, Symbol.species, {
          configurable: true,
          enumerable: false,
          get: function get() {
            // 1. Return the this value.
            return this;
          },
          set: undefined
        });
      } else {
        CreateMethodProperty(Map, Symbol.species, Map);
      } // 23.1.3.1 Map.prototype.clear ( )


      CreateMethodProperty(Map.prototype, 'clear', function clear() {
        // 1. Let M be the this value.
        var M = this; // 2. If Type(M) is not Object, throw a TypeError exception.

        if (Type(M) !== 'object') {
          throw new TypeError('Method Map.prototype.clear called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 3. If M does not have a [[MapData]] internal slot, throw a TypeError exception.


        if (M._es6Map !== true) {
          throw new TypeError('Method Map.prototype.clear called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 4. Let entries be the List that is M.[[MapData]].


        var entries = M._keys; // 5. For each Record {[[Key]], [[Value]]} p that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          // 5.a. Set p.[[Key]] to empty.
          M._keys[i] = undefMarker; // 5.b. Set p.[[Value]] to empty.

          M._values[i] = undefMarker;
        }

        this._size = 0;

        if (!supportsGetters) {
          this.size = this._size;
        } // 6. Return undefined.


        return undefined;
      }); // 23.1.3.2. Map.prototype.constructor

      CreateMethodProperty(Map.prototype, 'constructor', Map); // 23.1.3.3. Map.prototype.delete ( key )

      CreateMethodProperty(Map.prototype, 'delete', function (key) {
        // 1. Let M be the this value.
        var M = this; // 2. If Type(M) is not Object, throw a TypeError exception.

        if (Type(M) !== 'object') {
          throw new TypeError('Method Map.prototype.clear called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 3. If M does not have a [[MapData]] internal slot, throw a TypeError exception.


        if (M._es6Map !== true) {
          throw new TypeError('Method Map.prototype.clear called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 4. Let entries be the List that is M.[[MapData]].


        var entries = M._keys; // 5. For each Record {[[Key]], [[Value]]} p that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          // a. If p.[[Key]] is not empty and SameValueZero(p.[[Key]], key) is true, then
          if (M._keys[i] !== undefMarker && SameValueZero(M._keys[i], key)) {
            // i. Set p.[[Key]] to empty.
            this._keys[i] = undefMarker; // ii. Set p.[[Value]] to empty.

            this._values[i] = undefMarker;
            this._size = --this._size;

            if (!supportsGetters) {
              this.size = this._size;
            } // iii. Return true.


            return true;
          }
        } // 6. Return false.


        return false;
      }); // 23.1.3.4. Map.prototype.entries ( )

      CreateMethodProperty(Map.prototype, 'entries', function entries() {
        // 1. Let M be the this value.
        var M = this; // 2. Return ? CreateMapIterator(M, "key+value").

        return CreateMapIterator(M, 'key+value');
      }); // 23.1.3.5. Map.prototype.forEach ( callbackfn [ , thisArg ] )

      CreateMethodProperty(Map.prototype, 'forEach', function (callbackFn) {
        // 1. Let M be the this value.
        var M = this; // 2. If Type(M) is not Object, throw a TypeError exception.

        if (Type(M) !== 'object') {
          throw new TypeError('Method Map.prototype.forEach called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 3. If M does not have a [[MapData]] internal slot, throw a TypeError exception.


        if (M._es6Map !== true) {
          throw new TypeError('Method Map.prototype.forEach called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 4. If IsCallable(callbackfn) is false, throw a TypeError exception.


        if (!IsCallable(callbackFn)) {
          throw new TypeError(Object.prototype.toString.call(callbackFn) + ' is not a function.');
        } // 5. If thisArg is present, let T be thisArg; else let T be undefined.


        if (arguments[1]) {
          var T = arguments[1];
        } // 6. Let entries be the List that is M.[[MapData]].


        var entries = M._keys; // 7. For each Record {[[Key]], [[Value]]} e that is an element of entries, in original key insertion order, do

        for (var i = 0; i < entries.length; i++) {
          // a. If e.[[Key]] is not empty, then
          if (M._keys[i] !== undefMarker && M._values[i] !== undefMarker) {
            // i. Perform ? Call(callbackfn, T, « e.[[Value]], e.[[Key]], M »).
            callbackFn.call(T, M._values[i], M._keys[i], M);
          }
        } // 8. Return undefined.


        return undefined;
      }); // 23.1.3.6. Map.prototype.get ( key )

      CreateMethodProperty(Map.prototype, 'get', function get(key) {
        // 1. Let M be the this value.
        var M = this; // 2. If Type(M) is not Object, throw a TypeError exception.

        if (Type(M) !== 'object') {
          throw new TypeError('Method Map.prototype.get called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 3. If M does not have a [[MapData]] internal slot, throw a TypeError exception.


        if (M._es6Map !== true) {
          throw new TypeError('Method Map.prototype.get called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 4. Let entries be the List that is M.[[MapData]].


        var entries = M._keys; // 5. For each Record {[[Key]], [[Value]]} p that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          // a. If p.[[Key]] is not empty and SameValueZero(p.[[Key]], key) is true, return p.[[Value]].
          if (M._keys[i] !== undefMarker && SameValueZero(M._keys[i], key)) {
            return M._values[i];
          }
        } // 6. Return undefined.


        return undefined;
      }); // 23.1.3.7. Map.prototype.has ( key )

      CreateMethodProperty(Map.prototype, 'has', function has(key) {
        // 1. Let M be the this value.
        var M = this; // 2. If Type(M) is not Object, throw a TypeError exception.

        if (_typeof(M) !== 'object') {
          throw new TypeError('Method Map.prototype.has called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 3. If M does not have a [[MapData]] internal slot, throw a TypeError exception.


        if (M._es6Map !== true) {
          throw new TypeError('Method Map.prototype.has called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 4. Let entries be the List that is M.[[MapData]].


        var entries = M._keys; // 5. For each Record {[[Key]], [[Value]]} p that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          // a. If p.[[Key]] is not empty and SameValueZero(p.[[Key]], key) is true, return true.
          if (M._keys[i] !== undefMarker && SameValueZero(M._keys[i], key)) {
            return true;
          }
        } // 6. Return false.


        return false;
      }); // 23.1.3.8. Map.prototype.keys ( )

      CreateMethodProperty(Map.prototype, 'keys', function keys() {
        // 1. Let M be the this value.
        var M = this; // 2. Return ? CreateMapIterator(M, "key").

        return CreateMapIterator(M, "key");
      }); // 23.1.3.9. Map.prototype.set ( key, value )

      CreateMethodProperty(Map.prototype, 'set', function set(key, value) {
        // 1. Let M be the this value.
        var M = this; // 2. If Type(M) is not Object, throw a TypeError exception.

        if (Type(M) !== 'object') {
          throw new TypeError('Method Map.prototype.set called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 3. If M does not have a [[MapData]] internal slot, throw a TypeError exception.


        if (M._es6Map !== true) {
          throw new TypeError('Method Map.prototype.set called on incompatible receiver ' + Object.prototype.toString.call(M));
        } // 4. Let entries be the List that is M.[[MapData]].


        var entries = M._keys; // 5. For each Record {[[Key]], [[Value]]} p that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          // a. If p.[[Key]] is not empty and SameValueZero(p.[[Key]], key) is true, then
          if (M._keys[i] !== undefMarker && SameValueZero(M._keys[i], key)) {
            // i. Set p.[[Value]] to value.
            M._values[i] = value; // Return M.

            return M;
          }
        } // 6. If key is -0, let key be +0.


        if (key === -0) {
          key = 0;
        } // 7. Let p be the Record {[[Key]]: key, [[Value]]: value}.


        var p = {};
        p['[[Key]]'] = key;
        p['[[Value]]'] = value; // 8. Append p as the last element of entries.

        M._keys.push(p['[[Key]]']);

        M._values.push(p['[[Value]]']);

        ++M._size;

        if (!supportsGetters) {
          M.size = M._size;
        } // 9. Return M.


        return M;
      }); // 23.1.3.10. get Map.prototype.size

      if (supportsGetters) {
        Object.defineProperty(Map.prototype, 'size', {
          configurable: true,
          enumerable: false,
          get: function get() {
            // 1. Let M be the this value.
            var M = this; // 2. If Type(M) is not Object, throw a TypeError exception.

            if (Type(M) !== 'object') {
              throw new TypeError('Method Map.prototype.size called on incompatible receiver ' + Object.prototype.toString.call(M));
            } // 3. If M does not have a [[MapData]] internal slot, throw a TypeError exception.


            if (M._es6Map !== true) {
              throw new TypeError('Method Map.prototype.size called on incompatible receiver ' + Object.prototype.toString.call(M));
            } // 4. Let entries be the List that is M.[[MapData]].


            var entries = M._keys; // 5. Let count be 0.

            var count = 0; // 6. For each Record {[[Key]], [[Value]]} p that is an element of entries, do

            for (var i = 0; i < entries.length; i++) {
              // a. If p.[[Key]] is not empty, set count to count+1.
              if (M._keys[i] !== undefMarker) {
                count = count + 1;
              }
            } // 7. Return count.


            return count;
          },
          set: undefined
        });
      } // 23.1.3.11. Map.prototype.values ( )


      CreateMethodProperty(Map.prototype, 'values', function values() {
        // 1. Let M be the this value.
        var M = this; // 2. Return ? CreateMapIterator(M, "value").

        return CreateMapIterator(M, 'value');
      }); // 23.1.3.12. Map.prototype [ @@iterator ] ( )
      // The initial value of the @@iterator property is the same function object as the initial value of the entries property.

      CreateMethodProperty(Map.prototype, Symbol.iterator, Map.prototype.entries); // 23.1.3.13. Map.prototype [ @@toStringTag ]
      // The initial value of the @@toStringTag property is the String value "Map".
      // This property has the attributes { [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: true }.
      // Polyfill.io - Safari 8 implements Map.name but as a non-configurable property, which means it would throw an error if we try and configure it here.

      if (!('name' in Map)) {
        // 19.2.4.2 name
        Object.defineProperty(Map, 'name', {
          configurable: true,
          enumerable: false,
          writable: false,
          value: 'Map'
        });
      } // 23.1.5.1. CreateMapIterator ( map, kind )


      function CreateMapIterator(map, kind) {
        // 1. If Type(map) is not Object, throw a TypeError exception.
        if (Type(map) !== 'object') {
          throw new TypeError('createMapIterator called on incompatible receiver ' + Object.prototype.toString.call(map));
        } // 2. If map does not have a [[MapData]] internal slot, throw a TypeError exception.


        if (map._es6Map !== true) {
          throw new TypeError('createMapIterator called on incompatible receiver ' + Object.prototype.toString.call(map));
        } // 3. Let iterator be ObjectCreate(%MapIteratorPrototype%, « [[Map]], [[MapNextIndex]], [[MapIterationKind]] »).


        var iterator = Object.create(MapIteratorPrototype); // 4. Set iterator.[[Map]] to map.

        Object.defineProperty(iterator, '[[Map]]', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: map
        }); // 5. Set iterator.[[MapNextIndex]] to 0.

        Object.defineProperty(iterator, '[[MapNextIndex]]', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: 0
        }); // 6. Set iterator.[[MapIterationKind]] to kind.

        Object.defineProperty(iterator, '[[MapIterationKind]]', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: kind
        }); // 7. Return iterator.

        return iterator;
      } // 23.1.5.2. The %MapIteratorPrototype% Object


      var MapIteratorPrototype = {}; // Polyfill.io - We use this as a quick way to check if an object is a Map Iterator instance.

      Object.defineProperty(MapIteratorPrototype, 'isMapIterator', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: true
      }); // 23.1.5.2.1. %MapIteratorPrototype%.next ( )

      CreateMethodProperty(MapIteratorPrototype, 'next', function next() {
        // 1. Let O be the this value.
        var O = this; // 2. If Type(O) is not Object, throw a TypeError exception.

        if (Type(O) !== 'object') {
          throw new TypeError('Method %MapIteratorPrototype%.next called on incompatible receiver ' + Object.prototype.toString.call(O));
        } // 3. If O does not have all of the internal slots of a Map Iterator Instance (23.1.5.3), throw a TypeError exception.


        if (!O.isMapIterator) {
          throw new TypeError('Method %MapIteratorPrototype%.next called on incompatible receiver ' + Object.prototype.toString.call(O));
        } // 4. Let m be O.[[Map]].


        var m = O['[[Map]]']; // 5. Let index be O.[[MapNextIndex]].

        var index = O['[[MapNextIndex]]']; // 6. Let itemKind be O.[[MapIterationKind]].

        var itemKind = O['[[MapIterationKind]]']; // 7. If m is undefined, return CreateIterResultObject(undefined, true).

        if (m === undefined) {
          return CreateIterResultObject(undefined, true);
        } // 8. Assert: m has a [[MapData]] internal slot.


        if (!m._es6Map) {
          throw new Error(Object.prototype.toString.call(m) + ' has a [[MapData]] internal slot.');
        } // 9. Let entries be the List that is m.[[MapData]].


        var entries = m._keys; // 10. Let numEntries be the number of elements of entries.

        var numEntries = entries.length; // 11. NOTE: numEntries must be redetermined each time this method is evaluated.
        // 12. Repeat, while index is less than numEntries,

        while (index < numEntries) {
          // a. Let e be the Record {[[Key]], [[Value]]} that is the value of entries[index].
          var e = Object.create(null);
          e['[[Key]]'] = m._keys[index];
          e['[[Value]]'] = m._values[index]; // b. Set index to index+1.

          index = index + 1; // c. Set O.[[MapNextIndex]] to index.

          O['[[MapNextIndex]]'] = index; // d. If e.[[Key]] is not empty, then

          if (e['[[Key]]'] !== undefMarker) {
            // i. If itemKind is "key", let result be e.[[Key]].
            if (itemKind === 'key') {
              var result = e['[[Key]]']; // ii. Else if itemKind is "value", let result be e.[[Value]].
            } else if (itemKind === 'value') {
              result = e['[[Value]]']; // iii. Else,
            } else {
              // 1. Assert: itemKind is "key+value".
              if (itemKind !== 'key+value') {
                throw new Error();
              } // 2. Let result be CreateArrayFromList(« e.[[Key]], e.[[Value]] »).


              result = [e['[[Key]]'], e['[[Value]]']];
            } // iv. Return CreateIterResultObject(result, false).


            return CreateIterResultObject(result, false);
          }
        } // 13. Set O.[[Map]] to undefined.


        O['[[Map]]'] = undefined; // 14. Return CreateIterResultObject(undefined, true).

        return CreateIterResultObject(undefined, true);
      }); // 23.1.5.2.2 %MapIteratorPrototype% [ @@toStringTag ]
      // The initial value of the @@toStringTag property is the String value "Map Iterator".
      // This property has the attributes { [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: true }.

      CreateMethodProperty(MapIteratorPrototype, Symbol.iterator, function iterator() {
        return this;
      }); // Export the object

      try {
        CreateMethodProperty(global, 'Map', Map);
      } catch (e) {
        // IE8 throws an error here if we set enumerable to false.
        // More info on table 2: https://msdn.microsoft.com/en-us/library/dd229916(v=vs.85).aspx
        global['Map'] = Map;
      }
    })(this);
  }

  if (!("Set" in this && function () {
    try {
      var t = new Set([1, 2]);
      return 0 === Set.length && 2 === t.size && "Symbol" in this && "iterator" in Symbol && "function" == typeof t[Symbol.iterator];
    } catch (e) {
      return !1;
    }
  }())) {
    // Set

    /* global CreateIterResultObject, CreateMethodProperty, GetIterator, IsCallable, IteratorClose, IteratorStep, IteratorValue, OrdinaryCreateFromConstructor, SameValueZero, Symbol */
    (function (global) {
      var supportsGetters = function () {
        try {
          var a = {};
          Object.defineProperty(a, 't', {
            configurable: true,
            enumerable: false,
            get: function get() {
              return true;
            },
            set: undefined
          });
          return !!a.t;
        } catch (e) {
          return false;
        }
      }(); // Deleted set items mess with iterator pointers, so rather than removing them mark them as deleted. Can't use undefined or null since those both valid keys so use a private symbol.


      var undefMarker = Symbol('undef'); // 23.2.1.1. Set ( [ iterable ] )

      var Set = function Set()
      /* iterable */
      {
        // 1. If NewTarget is undefined, throw a TypeError exception.
        if (!(this instanceof Set)) {
          throw new TypeError('Constructor Set requires "new"');
        } // 2. Let set be ? OrdinaryCreateFromConstructor(NewTarget, "%SetPrototype%", « [[SetData]] »).


        var set = OrdinaryCreateFromConstructor(this, Set.prototype, {
          _values: [],
          _size: 0,
          _es6Set: true
        }); // 3. Set set.[[SetData]] to a new empty List.
        // Polyfill.io - This step was done as part of step two.
        // Some old engines do not support ES5 getters/setters.  Since Set only requires these for the size property, we can fall back to setting the size property statically each time the size of the set changes.

        if (!supportsGetters) {
          Object.defineProperty(set, 'size', {
            configurable: true,
            enumerable: false,
            writable: true,
            value: 0
          });
        } // 4. If iterable is not present, let iterable be undefined.


        var iterable = arguments.length > 0 ? arguments[0] : undefined; // 5. If iterable is either undefined or null, return set.

        if (iterable === null || iterable === undefined) {
          return set;
        } // 6. Let adder be ? Get(set, "add").


        var adder = set.add; // 7. If IsCallable(adder) is false, throw a TypeError exception.

        if (!IsCallable(adder)) {
          throw new TypeError("Set.prototype.add is not a function");
        }

        try {
          // 8. Let iteratorRecord be ? GetIterator(iterable).
          var iteratorRecord = GetIterator(iterable); // 9. Repeat,

          while (true) {
            // a. Let next be ? IteratorStep(iteratorRecord).
            var next = IteratorStep(iteratorRecord); // b. If next is false, return set.

            if (next === false) {
              return set;
            } // c. Let nextValue be ? IteratorValue(next).


            var nextValue = IteratorValue(next); // d. Let status be Call(adder, set, « nextValue.[[Value]] »).

            try {
              adder.call(set, nextValue);
            } catch (e) {
              // e. If status is an abrupt completion, return ? IteratorClose(iteratorRecord, status).
              return IteratorClose(iteratorRecord, e);
            }
          }
        } catch (e) {
          // Polyfill.io - For user agents which do not have iteration methods on argument objects or arrays, we can special case those.
          if (Array.isArray(iterable) || Object.prototype.toString.call(iterable) === '[object Arguments]' || // IE 7 & IE 8 return '[object Object]' for the arguments object, we can detect by checking for the existence of the callee property
          !!iterable.callee) {
            var index;
            var length = iterable.length;

            for (index = 0; index < length; index++) {
              adder.call(set, iterable[index]);
            }
          } else {
            throw e;
          }
        }

        return set;
      }; // 23.2.2.1. Set.prototype
      // The initial value of Set.prototype is the intrinsic %SetPrototype% object.
      // This property has the attributes { [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: false }.


      Object.defineProperty(Set, 'prototype', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: {}
      }); // 23.2.2.2 get Set [ @@species ]

      if (supportsGetters) {
        Object.defineProperty(Set, Symbol.species, {
          configurable: true,
          enumerable: false,
          get: function get() {
            // 1. Return the this value.
            return this;
          },
          set: undefined
        });
      } else {
        CreateMethodProperty(Set, Symbol.species, Set);
      } // 23.2.3.1. Set.prototype.add ( value )


      CreateMethodProperty(Set.prototype, 'add', function add(value) {
        // 1. Let S be the this value.
        var S = this; // 2. If Type(S) is not Object, throw a TypeError exception.

        if (_typeof(S) !== 'object') {
          throw new TypeError('Method Set.prototype.add called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 3. If S does not have a [[SetData]] internal slot, throw a TypeError exception.


        if (S._es6Set !== true) {
          throw new TypeError('Method Set.prototype.add called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 4. Let entries be the List that is S.[[SetData]].


        var entries = S._values; // 5. For each e that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          var e = entries[i]; // a. If e is not empty and SameValueZero(e, value) is true, then

          if (e !== undefMarker && SameValueZero(e, value)) {
            // i. Return S.
            return S;
          }
        } // 6. If value is -0, let value be +0.


        if (1 / value === -Infinity) {
          value = 0;
        } // 7. Append value as the last element of entries.


        S._values.push(value);

        this._size = ++this._size;

        if (!supportsGetters) {
          this.size = this._size;
        } // 8. Return S.


        return S;
      }); // 23.2.3.2. Set.prototype.clear ( )

      CreateMethodProperty(Set.prototype, 'clear', function clear() {
        // 1. Let S be the this value.
        var S = this; // 2. If Type(S) is not Object, throw a TypeError exception.

        if (_typeof(S) !== 'object') {
          throw new TypeError('Method Set.prototype.clear called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 3. If S does not have a [[SetData]] internal slot, throw a TypeError exception.


        if (S._es6Set !== true) {
          throw new TypeError('Method Set.prototype.clear called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 4. Let entries be the List that is S.[[SetData]].


        var entries = S._values; // 5. For each e that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          // a. Replace the element of entries whose value is e with an element whose value is empty.
          entries[i] = undefMarker;
        }

        this._size = 0;

        if (!supportsGetters) {
          this.size = this._size;
        } // 6. Return undefined.


        return undefined;
      }); // 23.2.3.3. Set.prototype.constructor

      CreateMethodProperty(Set.prototype, 'constructor', Set); // 23.2.3.4. Set.prototype.delete ( value )

      CreateMethodProperty(Set.prototype, 'delete', function (value) {
        // 1. Let S be the this value.
        var S = this; // 2. If Type(S) is not Object, throw a TypeError exception.

        if (_typeof(S) !== 'object') {
          throw new TypeError('Method Set.prototype.delete called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 3. If S does not have a [[SetData]] internal slot, throw a TypeError exception.


        if (S._es6Set !== true) {
          throw new TypeError('Method Set.prototype.delete called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 4. Let entries be the List that is S.[[SetData]].


        var entries = S._values; // 5. For each e that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          var e = entries[i]; // a. If e is not empty and SameValueZero(e, value) is true, then

          if (e !== undefMarker && SameValueZero(e, value)) {
            // i. Replace the element of entries whose value is e with an element whose value is empty.
            entries[i] = undefMarker;
            this._size = --this._size;

            if (!supportsGetters) {
              this.size = this._size;
            } // ii. Return true.


            return true;
          }
        } // 6. Return false.


        return false;
      }); // 23.2.3.5. Set.prototype.entries ( )

      CreateMethodProperty(Set.prototype, 'entries', function entries() {
        // 1. Let S be the this value.
        var S = this; // 2. Return ? CreateSetIterator(S, "key+value").

        return CreateSetIterator(S, 'key+value');
      }); // 23.2.3.6. Set.prototype.forEach ( callbackfn [ , thisArg ] )

      CreateMethodProperty(Set.prototype, 'forEach', function forEach(callbackFn
      /*[ , thisArg ]*/
      ) {
        // 1. Let S be the this value.
        var S = this; // 2. If Type(S) is not Object, throw a TypeError exception.

        if (_typeof(S) !== 'object') {
          throw new TypeError('Method Set.prototype.forEach called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 3. If S does not have a [[SetData]] internal slot, throw a TypeError exception.


        if (S._es6Set !== true) {
          throw new TypeError('Method Set.prototype.forEach called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 4. If IsCallable(callbackfn) is false, throw a TypeError exception.


        if (!IsCallable(callbackFn)) {
          throw new TypeError(Object.prototype.toString.call(callbackFn) + ' is not a function.');
        } // 5. If thisArg is present, let T be thisArg; else let T be undefined.


        if (arguments[1]) {
          var T = arguments[1];
        } // 6. Let entries be the List that is S.[[SetData]].


        var entries = S._values; // 7. For each e that is an element of entries, in original insertion order, do

        for (var i = 0; i < entries.length; i++) {
          var e = entries[i]; // a. If e is not empty, then

          if (e !== undefMarker) {
            // i. Perform ? Call(callbackfn, T, « e, e, S »).
            callbackFn.call(T, e, e, S);
          }
        } // 8. Return undefined.


        return undefined;
      }); // 23.2.3.7. Set.prototype.has ( value )

      CreateMethodProperty(Set.prototype, 'has', function has(value) {
        // 1. Let S be the this value.
        var S = this; // 2. If Type(S) is not Object, throw a TypeError exception.

        if (_typeof(S) !== 'object') {
          throw new TypeError('Method Set.prototype.forEach called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 3. If S does not have a [[SetData]] internal slot, throw a TypeError exception.


        if (S._es6Set !== true) {
          throw new TypeError('Method Set.prototype.forEach called on incompatible receiver ' + Object.prototype.toString.call(S));
        } // 4. Let entries be the List that is S.[[SetData]].


        var entries = S._values; // 5. For each e that is an element of entries, do

        for (var i = 0; i < entries.length; i++) {
          var e = entries[i]; // a. If e is not empty and SameValueZero(e, value) is true, return true.

          if (e !== undefMarker && SameValueZero(e, value)) {
            return true;
          }
        } // 6. Return false.


        return false;
      }); // Polyfill.io - We need to define Set.prototype.values before Set.prototype.keys because keys is a reference to values.
      // 23.2.3.10. Set.prototype.values()

      var values = function values() {
        // 1. Let S be the this value.
        var S = this; // 2. Return ? CreateSetIterator(S, "value").

        return CreateSetIterator(S, "value");
      };

      CreateMethodProperty(Set.prototype, 'values', values); // 23.2.3.8 Set.prototype.keys ( )
      // The initial value of the keys property is the same function object as the initial value of the values property.

      CreateMethodProperty(Set.prototype, 'keys', values); // 23.2.3.9. get Set.prototype.size

      if (supportsGetters) {
        Object.defineProperty(Set.prototype, 'size', {
          configurable: true,
          enumerable: false,
          get: function get() {
            // 1. Let S be the this value.
            var S = this; // 2. If Type(S) is not Object, throw a TypeError exception.

            if (_typeof(S) !== 'object') {
              throw new TypeError('Method Set.prototype.size called on incompatible receiver ' + Object.prototype.toString.call(S));
            } // 3. If S does not have a [[SetData]] internal slot, throw a TypeError exception.


            if (S._es6Set !== true) {
              throw new TypeError('Method Set.prototype.size called on incompatible receiver ' + Object.prototype.toString.call(S));
            } // 4. Let entries be the List that is S.[[SetData]].


            var entries = S._values; // 5. Let count be 0.

            var count = 0; // 6. For each e that is an element of entries, do

            for (var i = 0; i < entries.length; i++) {
              var e = entries[i]; // a. If e is not empty, set count to count+1.

              if (e !== undefMarker) {
                count = count + 1;
              }
            } // 7. Return count.


            return count;
          },
          set: undefined
        });
      } // 23.2.3.11. Set.prototype [ @@iterator ] ( )
      // The initial value of the @@iterator property is the same function object as the initial value of the values property.


      CreateMethodProperty(Set.prototype, Symbol.iterator, values); // 23.2.3.12. Set.prototype [ @@toStringTag ]
      // The initial value of the @@toStringTag property is the String value "Set".
      // This property has the attributes { [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: true }.
      // Polyfill.io - Safari 8 implements Set.name but as a non-configurable property, which means it would throw an error if we try and configure it here.

      if (!('name' in Set)) {
        // 19.2.4.2 name
        Object.defineProperty(Set, 'name', {
          configurable: true,
          enumerable: false,
          writable: false,
          value: 'Set'
        });
      } // 23.2.5.1. CreateSetIterator ( set, kind )


      function CreateSetIterator(set, kind) {
        // 1. If Type(set) is not Object, throw a TypeError exception.
        if (_typeof(set) !== 'object') {
          throw new TypeError('createSetIterator called on incompatible receiver ' + Object.prototype.toString.call(set));
        } // 2. If set does not have a [[SetData]] internal slot, throw a TypeError exception.


        if (set._es6Set !== true) {
          throw new TypeError('createSetIterator called on incompatible receiver ' + Object.prototype.toString.call(set));
        } // 3. Let iterator be ObjectCreate(%SetIteratorPrototype%, « [[IteratedSet]], [[SetNextIndex]], [[SetIterationKind]] »).


        var iterator = Object.create(SetIteratorPrototype); // 4. Set iterator.[[IteratedSet]] to set.

        Object.defineProperty(iterator, '[[IteratedSet]]', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: set
        }); // 5. Set iterator.[[SetNextIndex]] to 0.

        Object.defineProperty(iterator, '[[SetNextIndex]]', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: 0
        }); // 6. Set iterator.[[SetIterationKind]] to kind.

        Object.defineProperty(iterator, '[[SetIterationKind]]', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: kind
        }); // 7. Return iterator.

        return iterator;
      } // 23.2.5.2. The %SetIteratorPrototype% Object


      var SetIteratorPrototype = {}; //Polyfill.io - We add this property to help us identify what is a set iterator.

      Object.defineProperty(SetIteratorPrototype, 'isSetIterator', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: true
      }); // 23.2.5.2.1. %SetIteratorPrototype%.next ( )

      CreateMethodProperty(SetIteratorPrototype, 'next', function next() {
        // 1. Let O be the this value.
        var O = this; // 2. If Type(O) is not Object, throw a TypeError exception.

        if (_typeof(O) !== 'object') {
          throw new TypeError('Method %SetIteratorPrototype%.next called on incompatible receiver ' + Object.prototype.toString.call(O));
        } // 3. If O does not have all of the internal slots of a Set Iterator Instance (23.2.5.3), throw a TypeError exception.


        if (!O.isSetIterator) {
          throw new TypeError('Method %SetIteratorPrototype%.next called on incompatible receiver ' + Object.prototype.toString.call(O));
        } // 4. Let s be O.[[IteratedSet]].


        var s = O['[[IteratedSet]]']; // 5. Let index be O.[[SetNextIndex]].

        var index = O['[[SetNextIndex]]']; // 6. Let itemKind be O.[[SetIterationKind]].

        var itemKind = O['[[SetIterationKind]]']; // 7. If s is undefined, return CreateIterResultObject(undefined, true).

        if (s === undefined) {
          return CreateIterResultObject(undefined, true);
        } // 8. Assert: s has a [[SetData]] internal slot.


        if (!s._es6Set) {
          throw new Error(Object.prototype.toString.call(s) + ' does not have [[SetData]] internal slot.');
        } // 9. Let entries be the List that is s.[[SetData]].


        var entries = s._values; // 10. Let numEntries be the number of elements of entries.

        var numEntries = entries.length; // 11. NOTE: numEntries must be redetermined each time this method is evaluated.
        // 12. Repeat, while index is less than numEntries,

        while (index < numEntries) {
          // a. Let e be entries[index].
          var e = entries[index]; // b. Set index to index+1.

          index = index + 1; // c. Set O.[[SetNextIndex]] to index.

          O['[[SetNextIndex]]'] = index; // d. If e is not empty, then

          if (e !== undefMarker) {
            // i. If itemKind is "key+value", then
            if (itemKind === 'key+value') {
              // 1. Return CreateIterResultObject(CreateArrayFromList(« e, e »), false).
              return CreateIterResultObject([e, e], false);
            } // ii. Return CreateIterResultObject(e, false).


            return CreateIterResultObject(e, false);
          }
        } // 13. Set O.[[IteratedSet]] to undefined.


        O['[[IteratedSet]]'] = undefined; // 14. Return CreateIterResultObject(undefined, true).

        return CreateIterResultObject(undefined, true);
      }); // 23.2.5.2.2. %SetIteratorPrototype% [ @@toStringTag ]
      // The initial value of the @@toStringTag property is the String value "Set Iterator".
      // This property has the attributes { [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: true }.

      CreateMethodProperty(SetIteratorPrototype, Symbol.iterator, function iterator() {
        return this;
      }); // Export the object

      try {
        CreateMethodProperty(global, 'Set', Set);
      } catch (e) {
        // IE8 throws an error here if we set enumerable to false.
        // More info on table 2: https://msdn.microsoft.com/en-us/library/dd229916(v=vs.85).aspx
        global['Set'] = Set;
      }
    })(this);
  }

  if (!("Window" in this)) {
    // Window
    if (typeof WorkerGlobalScope === "undefined" && typeof importScripts !== "function") {
      (function (global) {
        if (global.constructor) {
          global.Window = global.constructor;
        } else {
          (global.Window = global.constructor = new Function('return function Window() {}')()).prototype = this;
        }
      })(this);
    }
  }

  if (!function (n) {
    if (!("Event" in n)) return !1;
    if ("function" == typeof n.Event) return !0;

    try {
      return new Event("click"), !0;
    } catch (t) {
      return !1;
    }
  }(this)) {
    // Event
    (function () {
      var unlistenableWindowEvents = {
        click: 1,
        dblclick: 1,
        keyup: 1,
        keypress: 1,
        keydown: 1,
        mousedown: 1,
        mouseup: 1,
        mousemove: 1,
        mouseover: 1,
        mouseenter: 1,
        mouseleave: 1,
        mouseout: 1,
        storage: 1,
        storagecommit: 1,
        textinput: 1
      }; // This polyfill depends on availability of `document` so will not run in a worker
      // However, we asssume there are no browsers with worker support that lack proper
      // support for `Event` within the worker

      if (typeof document === 'undefined' || typeof window === 'undefined') return;

      function indexOf(array, element) {
        var index = -1,
            length = array.length;

        while (++index < length) {
          if (index in array && array[index] === element) {
            return index;
          }
        }

        return -1;
      }

      var existingProto = window.Event && window.Event.prototype || null;

      function Event(type, eventInitDict) {
        if (!type) {
          throw new Error('Not enough arguments');
        }

        var event; // Shortcut if browser supports createEvent

        if ('createEvent' in document) {
          event = document.createEvent('Event');
          var bubbles = eventInitDict && eventInitDict.bubbles !== undefined ? eventInitDict.bubbles : false;
          var cancelable = eventInitDict && eventInitDict.cancelable !== undefined ? eventInitDict.cancelable : false;
          event.initEvent(type, bubbles, cancelable);
          return event;
        }

        event = document.createEventObject();
        event.type = type;
        event.bubbles = eventInitDict && eventInitDict.bubbles !== undefined ? eventInitDict.bubbles : false;
        event.cancelable = eventInitDict && eventInitDict.cancelable !== undefined ? eventInitDict.cancelable : false;
        return event;
      }

      ;
      Event.NONE = 0;
      Event.CAPTURING_PHASE = 1;
      Event.AT_TARGET = 2;
      Event.BUBBLING_PHASE = 3;
      window.Event = Window.prototype.Event = Event;

      if (existingProto) {
        Object.defineProperty(window.Event, 'prototype', {
          configurable: false,
          enumerable: false,
          writable: true,
          value: existingProto
        });
      }

      if (!('createEvent' in document)) {
        window.addEventListener = Window.prototype.addEventListener = Document.prototype.addEventListener = Element.prototype.addEventListener = function addEventListener() {
          var element = this,
              type = arguments[0],
              listener = arguments[1];

          if (element === window && type in unlistenableWindowEvents) {
            throw new Error('In IE8 the event: ' + type + ' is not available on the window object. Please see https://github.com/Financial-Times/polyfill-service/issues/317 for more information.');
          }

          if (!element._events) {
            element._events = {};
          }

          if (!element._events[type]) {
            element._events[type] = function (event) {
              var list = element._events[event.type].list,
                  events = list.slice(),
                  index = -1,
                  length = events.length,
                  eventElement;

              event.preventDefault = function preventDefault() {
                if (event.cancelable !== false) {
                  event.returnValue = false;
                }
              };

              event.stopPropagation = function stopPropagation() {
                event.cancelBubble = true;
              };

              event.stopImmediatePropagation = function stopImmediatePropagation() {
                event.cancelBubble = true;
                event.cancelImmediate = true;
              };

              event.currentTarget = element;
              event.relatedTarget = event.fromElement || null;
              event.target = event.target || event.srcElement || element;
              event.timeStamp = new Date().getTime();

              if (event.clientX) {
                event.pageX = event.clientX + document.documentElement.scrollLeft;
                event.pageY = event.clientY + document.documentElement.scrollTop;
              }

              while (++index < length && !event.cancelImmediate) {
                if (index in events) {
                  eventElement = events[index];

                  if (indexOf(list, eventElement) !== -1 && typeof eventElement === 'function') {
                    eventElement.call(element, event);
                  }
                }
              }
            };

            element._events[type].list = [];

            if (element.attachEvent) {
              element.attachEvent('on' + type, element._events[type]);
            }
          }

          element._events[type].list.push(listener);
        };

        window.removeEventListener = Window.prototype.removeEventListener = Document.prototype.removeEventListener = Element.prototype.removeEventListener = function removeEventListener() {
          var element = this,
              type = arguments[0],
              listener = arguments[1],
              index;

          if (element._events && element._events[type] && element._events[type].list) {
            index = indexOf(element._events[type].list, listener);

            if (index !== -1) {
              element._events[type].list.splice(index, 1);

              if (!element._events[type].list.length) {
                if (element.detachEvent) {
                  element.detachEvent('on' + type, element._events[type]);
                }

                delete element._events[type];
              }
            }
          }
        };

        window.dispatchEvent = Window.prototype.dispatchEvent = Document.prototype.dispatchEvent = Element.prototype.dispatchEvent = function dispatchEvent(event) {
          if (!arguments.length) {
            throw new Error('Not enough arguments');
          }

          if (!event || typeof event.type !== 'string') {
            throw new Error('DOM Events Exception 0');
          }

          var element = this,
              type = event.type;

          try {
            if (!event.bubbles) {
              event.cancelBubble = true;

              var cancelBubbleEvent = function cancelBubbleEvent(event) {
                event.cancelBubble = true;
                (element || window).detachEvent('on' + type, cancelBubbleEvent);
              };

              this.attachEvent('on' + type, cancelBubbleEvent);
            }

            this.fireEvent('on' + type, event);
          } catch (error) {
            event.target = element;

            do {
              event.currentTarget = element;

              if ('_events' in element && typeof element._events[type] === 'function') {
                element._events[type].call(element, event);
              }

              if (typeof element['on' + type] === 'function') {
                element['on' + type].call(element, event);
              }

              element = element.nodeType === 9 ? element.parentWindow : element.parentNode;
            } while (element && !event.cancelBubble);
          }

          return true;
        }; // Add the DOMContentLoaded Event


        document.attachEvent('onreadystatechange', function () {
          if (document.readyState === 'complete') {
            document.dispatchEvent(new Event('DOMContentLoaded', {
              bubbles: true
            }));
          }
        });
      }
    })();
  }

  if (!("CustomEvent" in this && ("function" == typeof this.CustomEvent || this.CustomEvent.toString().indexOf("CustomEventConstructor") > -1))) {
    // CustomEvent
    this.CustomEvent = function CustomEvent(type, eventInitDict) {
      if (!type) {
        throw Error('TypeError: Failed to construct "CustomEvent": An event name must be provided.');
      }

      var event;
      eventInitDict = eventInitDict || {
        bubbles: false,
        cancelable: false,
        detail: null
      };

      if ('createEvent' in document) {
        try {
          event = document.createEvent('CustomEvent');
          event.initCustomEvent(type, eventInitDict.bubbles, eventInitDict.cancelable, eventInitDict.detail);
        } catch (error) {
          // for browsers which don't support CustomEvent at all, we use a regular event instead
          event = document.createEvent('Event');
          event.initEvent(type, eventInitDict.bubbles, eventInitDict.cancelable);
          event.detail = eventInitDict.detail;
        }
      } else {
        // IE8
        event = new Event(type, eventInitDict);
        event.detail = eventInitDict && eventInitDict.detail || null;
      }

      return event;
    };

    CustomEvent.prototype = Event.prototype;
  }

  if (!("getComputedStyle" in this)) {
    // getComputedStyle
    (function (global) {
      function getComputedStylePixel(element, property, fontSize) {
        var // Internet Explorer sometimes struggles to read currentStyle until the element's document is accessed.
        value = element.document && element.currentStyle[property].match(/([\d\.]+)(%|cm|em|in|mm|pc|pt|)/) || [0, 0, ''],
            size = value[1],
            suffix = value[2],
            rootSize;
        fontSize = !fontSize ? fontSize : /%|em/.test(suffix) && element.parentElement ? getComputedStylePixel(element.parentElement, 'fontSize', null) : 16;
        rootSize = property == 'fontSize' ? fontSize : /width/i.test(property) ? element.clientWidth : element.clientHeight;
        return suffix == '%' ? size / 100 * rootSize : suffix == 'cm' ? size * 0.3937 * 96 : suffix == 'em' ? size * fontSize : suffix == 'in' ? size * 96 : suffix == 'mm' ? size * 0.3937 * 96 / 10 : suffix == 'pc' ? size * 12 * 96 / 72 : suffix == 'pt' ? size * 96 / 72 : size;
      }

      function setShortStyleProperty(style, property) {
        var borderSuffix = property == 'border' ? 'Width' : '',
            t = property + 'Top' + borderSuffix,
            r = property + 'Right' + borderSuffix,
            b = property + 'Bottom' + borderSuffix,
            l = property + 'Left' + borderSuffix;
        style[property] = (style[t] == style[r] && style[t] == style[b] && style[t] == style[l] ? [style[t]] : style[t] == style[b] && style[l] == style[r] ? [style[t], style[r]] : style[l] == style[r] ? [style[t], style[r], style[b]] : [style[t], style[r], style[b], style[l]]).join(' ');
      } // <CSSStyleDeclaration>


      function CSSStyleDeclaration(element) {
        var style = this,
            currentStyle = element.currentStyle,
            fontSize = getComputedStylePixel(element, 'fontSize'),
            unCamelCase = function unCamelCase(match) {
          return '-' + match.toLowerCase();
        },
            property;

        for (property in currentStyle) {
          Array.prototype.push.call(style, property == 'styleFloat' ? 'float' : property.replace(/[A-Z]/, unCamelCase));

          if (property == 'width') {
            style[property] = element.offsetWidth + 'px';
          } else if (property == 'height') {
            style[property] = element.offsetHeight + 'px';
          } else if (property == 'styleFloat') {
            style.float = currentStyle[property];
          } else if (/margin.|padding.|border.+W/.test(property) && style[property] != 'auto') {
            style[property] = Math.round(getComputedStylePixel(element, property, fontSize)) + 'px';
          } else if (/^outline/.test(property)) {
            // errors on checking outline
            try {
              style[property] = currentStyle[property];
            } catch (error) {
              style.outlineColor = currentStyle.color;
              style.outlineStyle = style.outlineStyle || 'none';
              style.outlineWidth = style.outlineWidth || '0px';
              style.outline = [style.outlineColor, style.outlineWidth, style.outlineStyle].join(' ');
            }
          } else {
            style[property] = currentStyle[property];
          }
        }

        setShortStyleProperty(style, 'margin');
        setShortStyleProperty(style, 'padding');
        setShortStyleProperty(style, 'border');
        style.fontSize = Math.round(fontSize) + 'px';
      }

      CSSStyleDeclaration.prototype = {
        constructor: CSSStyleDeclaration,
        // <CSSStyleDeclaration>.getPropertyPriority
        getPropertyPriority: function getPropertyPriority() {
          throw new Error('NotSupportedError: DOM Exception 9');
        },
        // <CSSStyleDeclaration>.getPropertyValue
        getPropertyValue: function getPropertyValue(property) {
          return this[property.replace(/-\w/g, function (match) {
            return match[1].toUpperCase();
          })];
        },
        // <CSSStyleDeclaration>.item
        item: function item(index) {
          return this[index];
        },
        // <CSSStyleDeclaration>.removeProperty
        removeProperty: function removeProperty() {
          throw new Error('NoModificationAllowedError: DOM Exception 7');
        },
        // <CSSStyleDeclaration>.setProperty
        setProperty: function setProperty() {
          throw new Error('NoModificationAllowedError: DOM Exception 7');
        },
        // <CSSStyleDeclaration>.getPropertyCSSValue
        getPropertyCSSValue: function getPropertyCSSValue() {
          throw new Error('NotSupportedError: DOM Exception 9');
        }
      }; // <Global>.getComputedStyle

      global.getComputedStyle = function getComputedStyle(element) {
        return new CSSStyleDeclaration(element);
      };
    })(this);
  }

  if (!("IntersectionObserver" in window && "IntersectionObserverEntry" in window)) {
    // IntersectionObserver

    /**
     * Copyright 2016 Google Inc. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *     http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    (function (window, document) {
      'use strict';
      /**
       * An IntersectionObserver registry. This registry exists to hold a strong
       * reference to IntersectionObserver instances currently observering a target
       * element. Without this registry, instances without another reference may be
       * garbage collected.
       */

      var registry = [];
      /**
       * Creates the global IntersectionObserverEntry constructor.
       * https://wicg.github.io/IntersectionObserver/#intersection-observer-entry
       * @param {Object} entry A dictionary of instance properties.
       * @constructor
       */

      function IntersectionObserverEntry(entry) {
        this.time = entry.time;
        this.target = entry.target;
        this.rootBounds = entry.rootBounds;
        this.boundingClientRect = entry.boundingClientRect;
        this.intersectionRect = entry.intersectionRect || getEmptyRect();

        try {
          this.isIntersecting = !!entry.intersectionRect;
        } catch (err) {} // This means we are using the IntersectionObserverEntry polyfill which has only defined a getter
        // Calculates the intersection ratio.


        var targetRect = this.boundingClientRect;
        var targetArea = targetRect.width * targetRect.height;
        var intersectionRect = this.intersectionRect;
        var intersectionArea = intersectionRect.width * intersectionRect.height; // Sets intersection ratio.

        if (targetArea) {
          this.intersectionRatio = intersectionArea / targetArea;
        } else {
          // If area is zero and is intersecting, sets to 1, otherwise to 0
          this.intersectionRatio = this.isIntersecting ? 1 : 0;
        }
      }
      /**
       * Creates the global IntersectionObserver constructor.
       * https://wicg.github.io/IntersectionObserver/#intersection-observer-interface
       * @param {Function} callback The function to be invoked after intersection
       *     changes have queued. The function is not invoked if the queue has
       *     been emptied by calling the `takeRecords` method.
       * @param {Object=} opt_options Optional configuration options.
       * @constructor
       */


      function IntersectionObserver(callback, opt_options) {
        var options = opt_options || {};

        if (typeof callback != 'function') {
          throw new Error('callback must be a function');
        }

        if (options.root && options.root.nodeType != 1) {
          throw new Error('root must be an Element');
        } // Binds and throttles `this._checkForIntersections`.


        this._checkForIntersections = throttle(this._checkForIntersections.bind(this), this.THROTTLE_TIMEOUT); // Private properties.

        this._callback = callback;
        this._observationTargets = [];
        this._queuedEntries = [];
        this._rootMarginValues = this._parseRootMargin(options.rootMargin); // Public properties.

        this.thresholds = this._initThresholds(options.threshold);
        this.root = options.root || null;
        this.rootMargin = this._rootMarginValues.map(function (margin) {
          return margin.value + margin.unit;
        }).join(' ');
      }
      /**
       * The minimum interval within which the document will be checked for
       * intersection changes.
       */


      IntersectionObserver.prototype.THROTTLE_TIMEOUT = 100;
      /**
       * The frequency in which the polyfill polls for intersection changes.
       * this can be updated on a per instance basis and must be set prior to
       * calling `observe` on the first target.
       */

      IntersectionObserver.prototype.POLL_INTERVAL = null;
      /**
       * Starts observing a target element for intersection changes based on
       * the thresholds values.
       * @param {Element} target The DOM element to observe.
       */

      IntersectionObserver.prototype.observe = function (target) {
        // If the target is already being observed, do nothing.
        if (this._observationTargets.some(function (item) {
          return item.element == target;
        })) {
          return;
        }

        if (!(target && target.nodeType == 1)) {
          throw new Error('target must be an Element');
        }

        this._registerInstance();

        this._observationTargets.push({
          element: target,
          entry: null
        });

        this._monitorIntersections();
      };
      /**
       * Stops observing a target element for intersection changes.
       * @param {Element} target The DOM element to observe.
       */


      IntersectionObserver.prototype.unobserve = function (target) {
        this._observationTargets = this._observationTargets.filter(function (item) {
          return item.element != target;
        });

        if (!this._observationTargets.length) {
          this._unmonitorIntersections();

          this._unregisterInstance();
        }
      };
      /**
       * Stops observing all target elements for intersection changes.
       */


      IntersectionObserver.prototype.disconnect = function () {
        this._observationTargets = [];

        this._unmonitorIntersections();

        this._unregisterInstance();
      };
      /**
       * Returns any queue entries that have not yet been reported to the
       * callback and clears the queue. This can be used in conjunction with the
       * callback to obtain the absolute most up-to-date intersection information.
       * @return {Array} The currently queued entries.
       */


      IntersectionObserver.prototype.takeRecords = function () {
        var records = this._queuedEntries.slice();

        this._queuedEntries = [];
        return records;
      };
      /**
       * Accepts the threshold value from the user configuration object and
       * returns a sorted array of unique threshold values. If a value is not
       * between 0 and 1 and error is thrown.
       * @private
       * @param {Array|number=} opt_threshold An optional threshold value or
       *     a list of threshold values, defaulting to [0].
       * @return {Array} A sorted list of unique and valid threshold values.
       */


      IntersectionObserver.prototype._initThresholds = function (opt_threshold) {
        var threshold = opt_threshold || [0];
        if (!Array.isArray(threshold)) threshold = [threshold];
        return threshold.sort().filter(function (t, i, a) {
          if (typeof t != 'number' || isNaN(t) || t < 0 || t > 1) {
            throw new Error('threshold must be a number between 0 and 1 inclusively');
          }

          return t !== a[i - 1];
        });
      };
      /**
       * Accepts the rootMargin value from the user configuration object
       * and returns an array of the four margin values as an object containing
       * the value and unit properties. If any of the values are not properly
       * formatted or use a unit other than px or %, and error is thrown.
       * @private
       * @param {string=} opt_rootMargin An optional rootMargin value,
       *     defaulting to '0px'.
       * @return {Array<Object>} An array of margin objects with the keys
       *     value and unit.
       */


      IntersectionObserver.prototype._parseRootMargin = function (opt_rootMargin) {
        var marginString = opt_rootMargin || '0px';
        var margins = marginString.split(/\s+/).map(function (margin) {
          var parts = /^(-?\d*\.?\d+)(px|%)$/.exec(margin);

          if (!parts) {
            throw new Error('rootMargin must be specified in pixels or percent');
          }

          return {
            value: parseFloat(parts[1]),
            unit: parts[2]
          };
        }); // Handles shorthand.

        margins[1] = margins[1] || margins[0];
        margins[2] = margins[2] || margins[0];
        margins[3] = margins[3] || margins[1];
        return margins;
      };
      /**
       * Starts polling for intersection changes if the polling is not already
       * happening, and if the page's visibilty state is visible.
       * @private
       */


      IntersectionObserver.prototype._monitorIntersections = function () {
        if (!this._monitoringIntersections) {
          this._monitoringIntersections = true;

          this._checkForIntersections(); // If a poll interval is set, use polling instead of listening to
          // resize and scroll events or DOM mutations.


          if (this.POLL_INTERVAL) {
            this._monitoringInterval = setInterval(this._checkForIntersections, this.POLL_INTERVAL);
          } else {
            addEvent(window, 'resize', this._checkForIntersections, true);
            addEvent(document, 'scroll', this._checkForIntersections, true);

            if ('MutationObserver' in window) {
              this._domObserver = new MutationObserver(this._checkForIntersections);

              this._domObserver.observe(document, {
                attributes: true,
                childList: true,
                characterData: true,
                subtree: true
              });
            }
          }
        }
      };
      /**
       * Stops polling for intersection changes.
       * @private
       */


      IntersectionObserver.prototype._unmonitorIntersections = function () {
        if (this._monitoringIntersections) {
          this._monitoringIntersections = false;
          clearInterval(this._monitoringInterval);
          this._monitoringInterval = null;
          removeEvent(window, 'resize', this._checkForIntersections, true);
          removeEvent(document, 'scroll', this._checkForIntersections, true);

          if (this._domObserver) {
            this._domObserver.disconnect();

            this._domObserver = null;
          }
        }
      };
      /**
       * Scans each observation target for intersection changes and adds them
       * to the internal entries queue. If new entries are found, it
       * schedules the callback to be invoked.
       * @private
       */


      IntersectionObserver.prototype._checkForIntersections = function () {
        var rootIsInDom = this._rootIsInDom();

        var rootRect = rootIsInDom ? this._getRootRect() : getEmptyRect();

        this._observationTargets.forEach(function (item) {
          var target = item.element;
          var targetRect = getBoundingClientRect(target);

          var rootContainsTarget = this._rootContainsTarget(target);

          var oldEntry = item.entry;

          var intersectionRect = rootIsInDom && rootContainsTarget && this._computeTargetAndRootIntersection(target, rootRect);

          var newEntry = item.entry = new IntersectionObserverEntry({
            time: now(),
            target: target,
            boundingClientRect: targetRect,
            rootBounds: rootRect,
            intersectionRect: intersectionRect
          });

          if (!oldEntry) {
            this._queuedEntries.push(newEntry);
          } else if (rootIsInDom && rootContainsTarget) {
            // If the new entry intersection ratio has crossed any of the
            // thresholds, add a new entry.
            if (this._hasCrossedThreshold(oldEntry, newEntry)) {
              this._queuedEntries.push(newEntry);
            }
          } else {
            // If the root is not in the DOM or target is not contained within
            // root but the previous entry for this target had an intersection,
            // add a new record indicating removal.
            if (oldEntry && oldEntry.isIntersecting) {
              this._queuedEntries.push(newEntry);
            }
          }
        }, this);

        if (this._queuedEntries.length) {
          this._callback(this.takeRecords(), this);
        }
      };
      /**
       * Accepts a target and root rect computes the intersection between then
       * following the algorithm in the spec.
       * TODO(philipwalton): at this time clip-path is not considered.
       * https://wicg.github.io/IntersectionObserver/#calculate-intersection-rect-algo
       * @param {Element} target The target DOM element
       * @param {Object} rootRect The bounding rect of the root after being
       *     expanded by the rootMargin value.
       * @return {?Object} The final intersection rect object or undefined if no
       *     intersection is found.
       * @private
       */


      IntersectionObserver.prototype._computeTargetAndRootIntersection = function (target, rootRect) {
        // If the element isn't displayed, an intersection can't happen.
        if (window.getComputedStyle(target).display == 'none') return;
        var targetRect = getBoundingClientRect(target);
        var intersectionRect = targetRect;
        var parent = getParentNode(target);
        var atRoot = false;

        while (!atRoot) {
          var parentRect = null;
          var parentComputedStyle = parent.nodeType == 1 ? window.getComputedStyle(parent) : {}; // If the parent isn't displayed, an intersection can't happen.

          if (parentComputedStyle.display == 'none') return;

          if (parent == this.root || parent == document) {
            atRoot = true;
            parentRect = rootRect;
          } else {
            // If the element has a non-visible overflow, and it's not the <body>
            // or <html> element, update the intersection rect.
            // Note: <body> and <html> cannot be clipped to a rect that's not also
            // the document rect, so no need to compute a new intersection.
            if (parent != document.body && parent != document.documentElement && parentComputedStyle.overflow != 'visible') {
              parentRect = getBoundingClientRect(parent);
            }
          } // If either of the above conditionals set a new parentRect,
          // calculate new intersection data.


          if (parentRect) {
            intersectionRect = computeRectIntersection(parentRect, intersectionRect);
            if (!intersectionRect) break;
          }

          parent = getParentNode(parent);
        }

        return intersectionRect;
      };
      /**
       * Returns the root rect after being expanded by the rootMargin value.
       * @return {Object} The expanded root rect.
       * @private
       */


      IntersectionObserver.prototype._getRootRect = function () {
        var rootRect;

        if (this.root) {
          rootRect = getBoundingClientRect(this.root);
        } else {
          // Use <html>/<body> instead of window since scroll bars affect size.
          var html = document.documentElement;
          var body = document.body;
          rootRect = {
            top: 0,
            left: 0,
            right: html.clientWidth || body.clientWidth,
            width: html.clientWidth || body.clientWidth,
            bottom: html.clientHeight || body.clientHeight,
            height: html.clientHeight || body.clientHeight
          };
        }

        return this._expandRectByRootMargin(rootRect);
      };
      /**
       * Accepts a rect and expands it by the rootMargin value.
       * @param {Object} rect The rect object to expand.
       * @return {Object} The expanded rect.
       * @private
       */


      IntersectionObserver.prototype._expandRectByRootMargin = function (rect) {
        var margins = this._rootMarginValues.map(function (margin, i) {
          return margin.unit == 'px' ? margin.value : margin.value * (i % 2 ? rect.width : rect.height) / 100;
        });

        var newRect = {
          top: rect.top - margins[0],
          right: rect.right + margins[1],
          bottom: rect.bottom + margins[2],
          left: rect.left - margins[3]
        };
        newRect.width = newRect.right - newRect.left;
        newRect.height = newRect.bottom - newRect.top;
        return newRect;
      };
      /**
       * Accepts an old and new entry and returns true if at least one of the
       * threshold values has been crossed.
       * @param {?IntersectionObserverEntry} oldEntry The previous entry for a
       *    particular target element or null if no previous entry exists.
       * @param {IntersectionObserverEntry} newEntry The current entry for a
       *    particular target element.
       * @return {boolean} Returns true if a any threshold has been crossed.
       * @private
       */


      IntersectionObserver.prototype._hasCrossedThreshold = function (oldEntry, newEntry) {
        // To make comparing easier, an entry that has a ratio of 0
        // but does not actually intersect is given a value of -1
        var oldRatio = oldEntry && oldEntry.isIntersecting ? oldEntry.intersectionRatio || 0 : -1;
        var newRatio = newEntry.isIntersecting ? newEntry.intersectionRatio || 0 : -1; // Ignore unchanged ratios

        if (oldRatio === newRatio) return;

        for (var i = 0; i < this.thresholds.length; i++) {
          var threshold = this.thresholds[i]; // Return true if an entry matches a threshold or if the new ratio
          // and the old ratio are on the opposite sides of a threshold.

          if (threshold == oldRatio || threshold == newRatio || threshold < oldRatio !== threshold < newRatio) {
            return true;
          }
        }
      };
      /**
       * Returns whether or not the root element is an element and is in the DOM.
       * @return {boolean} True if the root element is an element and is in the DOM.
       * @private
       */


      IntersectionObserver.prototype._rootIsInDom = function () {
        return !this.root || containsDeep(document, this.root);
      };
      /**
       * Returns whether or not the target element is a child of root.
       * @param {Element} target The target element to check.
       * @return {boolean} True if the target element is a child of root.
       * @private
       */


      IntersectionObserver.prototype._rootContainsTarget = function (target) {
        return containsDeep(this.root || document, target);
      };
      /**
       * Adds the instance to the global IntersectionObserver registry if it isn't
       * already present.
       * @private
       */


      IntersectionObserver.prototype._registerInstance = function () {
        if (registry.indexOf(this) < 0) {
          registry.push(this);
        }
      };
      /**
       * Removes the instance from the global IntersectionObserver registry.
       * @private
       */


      IntersectionObserver.prototype._unregisterInstance = function () {
        var index = registry.indexOf(this);
        if (index != -1) registry.splice(index, 1);
      };
      /**
       * Returns the result of the performance.now() method or null in browsers
       * that don't support the API.
       * @return {number} The elapsed time since the page was requested.
       */


      function now() {
        return window.performance && performance.now && performance.now();
      }
      /**
       * Throttles a function and delays its executiong, so it's only called at most
       * once within a given time period.
       * @param {Function} fn The function to throttle.
       * @param {number} timeout The amount of time that must pass before the
       *     function can be called again.
       * @return {Function} The throttled function.
       */


      function throttle(fn, timeout) {
        var timer = null;
        return function () {
          if (!timer) {
            timer = setTimeout(function () {
              fn();
              timer = null;
            }, timeout);
          }
        };
      }
      /**
       * Adds an event handler to a DOM node ensuring cross-browser compatibility.
       * @param {Node} node The DOM node to add the event handler to.
       * @param {string} event The event name.
       * @param {Function} fn The event handler to add.
       * @param {boolean} opt_useCapture Optionally adds the even to the capture
       *     phase. Note: this only works in modern browsers.
       */


      function addEvent(node, event, fn, opt_useCapture) {
        if (typeof node.addEventListener == 'function') {
          node.addEventListener(event, fn, opt_useCapture || false);
        } else if (typeof node.attachEvent == 'function') {
          node.attachEvent('on' + event, fn);
        }
      }
      /**
       * Removes a previously added event handler from a DOM node.
       * @param {Node} node The DOM node to remove the event handler from.
       * @param {string} event The event name.
       * @param {Function} fn The event handler to remove.
       * @param {boolean} opt_useCapture If the event handler was added with this
       *     flag set to true, it should be set to true here in order to remove it.
       */


      function removeEvent(node, event, fn, opt_useCapture) {
        if (typeof node.removeEventListener == 'function') {
          node.removeEventListener(event, fn, opt_useCapture || false);
        } else if (typeof node.detatchEvent == 'function') {
          node.detatchEvent('on' + event, fn);
        }
      }
      /**
       * Returns the intersection between two rect objects.
       * @param {Object} rect1 The first rect.
       * @param {Object} rect2 The second rect.
       * @return {?Object} The intersection rect or undefined if no intersection
       *     is found.
       */


      function computeRectIntersection(rect1, rect2) {
        var top = Math.max(rect1.top, rect2.top);
        var bottom = Math.min(rect1.bottom, rect2.bottom);
        var left = Math.max(rect1.left, rect2.left);
        var right = Math.min(rect1.right, rect2.right);
        var width = right - left;
        var height = bottom - top;
        return width >= 0 && height >= 0 && {
          top: top,
          bottom: bottom,
          left: left,
          right: right,
          width: width,
          height: height
        };
      }
      /**
       * Shims the native getBoundingClientRect for compatibility with older IE.
       * @param {Element} el The element whose bounding rect to get.
       * @return {Object} The (possibly shimmed) rect of the element.
       */


      function getBoundingClientRect(el) {
        var rect;

        try {
          rect = el.getBoundingClientRect();
        } catch (err) {// Ignore Windows 7 IE11 "Unspecified error"
          // https://github.com/WICG/IntersectionObserver/pull/205
        }

        if (!rect) return getEmptyRect(); // Older IE

        if (!(rect.width && rect.height)) {
          rect = {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top
          };
        }

        return rect;
      }
      /**
       * Returns an empty rect object. An empty rect is returned when an element
       * is not in the DOM.
       * @return {Object} The empty rect.
       */


      function getEmptyRect() {
        return {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0
        };
      }
      /**
       * Checks to see if a parent element contains a child elemnt (including inside
       * shadow DOM).
       * @param {Node} parent The parent element.
       * @param {Node} child The child element.
       * @return {boolean} True if the parent node contains the child node.
       */


      function containsDeep(parent, child) {
        var node = child;

        while (node) {
          if (node == parent) return true;
          node = getParentNode(node);
        }

        return false;
      }
      /**
       * Gets the parent node of an element or its host element if the parent node
       * is a shadow root.
       * @param {Node} node The node whose parent to get.
       * @return {Node|null} The parent node or null if no parent exists.
       */


      function getParentNode(node) {
        var parent = node.parentNode;

        if (parent && parent.nodeType == 11 && parent.host) {
          // If the parent is a shadow root, return the host element.
          return parent.host;
        }

        return parent;
      } // Exposes the constructors globally.


      window.IntersectionObserver = IntersectionObserver;
      window.IntersectionObserverEntry = IntersectionObserverEntry;
    })(window, document);
  }

  if (!("IntersectionObserverEntry" in window && "isIntersecting" in window.IntersectionObserverEntry.prototype)) {
    // IntersectionObserverEntry
    // Minimal polyfill for Edge 15's lack of `isIntersecting`
    // See: https://github.com/WICG/IntersectionObserver/issues/211
    Object.defineProperty(IntersectionObserverEntry.prototype, 'isIntersecting', {
      get: function get() {
        return this.intersectionRatio > 0;
      }
    });
  }

  if (!("XMLHttpRequest" in this && "prototype" in this.XMLHttpRequest && "addEventListener" in this.XMLHttpRequest.prototype)) {
    // XMLHttpRequest
    (function (global, NativeXMLHttpRequest) {
      // <Global>.XMLHttpRequest
      global.XMLHttpRequest = function XMLHttpRequest() {
        var request = this,
            nativeRequest = request._request = NativeXMLHttpRequest ? new NativeXMLHttpRequest() : new ActiveXObject('MSXML2.XMLHTTP.3.0');

        nativeRequest.onreadystatechange = function () {
          request.readyState = nativeRequest.readyState;
          var readyState = request.readyState === 4;
          request.response = request.responseText = readyState ? nativeRequest.responseText : null;
          request.status = readyState ? nativeRequest.status : null;
          request.statusText = readyState ? nativeRequest.statusText : null;
          request.dispatchEvent(new Event('readystatechange'));

          if (readyState) {
            request.dispatchEvent(new Event('load'));
          }
        };

        if ('onerror' in nativeRequest) {
          nativeRequest.onerror = function () {
            request.dispatchEvent(new Event('error'));
          };
        }
      };

      global.XMLHttpRequest.UNSENT = 0;
      global.XMLHttpRequest.OPENED = 1;
      global.XMLHttpRequest.HEADERS_RECEIVED = 2;
      global.XMLHttpRequest.LOADING = 3;
      global.XMLHttpRequest.DONE = 4;
      var XMLHttpRequestPrototype = global.XMLHttpRequest.prototype;
      XMLHttpRequestPrototype.addEventListener = global.addEventListener;
      XMLHttpRequestPrototype.removeEventListener = global.removeEventListener;
      XMLHttpRequestPrototype.dispatchEvent = global.dispatchEvent;

      XMLHttpRequestPrototype.abort = function abort() {
        return this._request();
      };

      XMLHttpRequestPrototype.getAllResponseHeaders = function getAllResponseHeaders() {
        return this._request.getAllResponseHeaders();
      };

      XMLHttpRequestPrototype.getResponseHeader = function getResponseHeader(header) {
        return this._request.getResponseHeader(header);
      };

      XMLHttpRequestPrototype.open = function open(method, url) {
        // method, url, async, username, password
        this._request.open(method, url, arguments[2], arguments[3], arguments[4]);
      };

      XMLHttpRequestPrototype.overrideMimeType = function overrideMimeType(mimetype) {
        this._request.overrideMimeType(mimetype);
      };

      XMLHttpRequestPrototype.send = function send() {
        this._request.send(0 in arguments ? arguments[0] : null);
      };

      XMLHttpRequestPrototype.setRequestHeader = function setRequestHeader(header, value) {
        this._request.setRequestHeader(header, value);
      };
    })(this, this.XMLHttpRequest);
  }

  if (!("fetch" in this)) {
    // fetch
    (function (self) {
      'use strict';

      var support = {
        searchParams: 'URLSearchParams' in self,
        iterable: 'Symbol' in self && 'iterator' in Symbol,
        blob: 'FileReader' in self && 'Blob' in self && function () {
          try {
            new Blob();
            return true;
          } catch (e) {
            return false;
          }
        }(),
        formData: 'FormData' in self,
        arrayBuffer: 'ArrayBuffer' in self
      };

      if (support.arrayBuffer) {
        var viewClasses = ['[object Int8Array]', '[object Uint8Array]', '[object Uint8ClampedArray]', '[object Int16Array]', '[object Uint16Array]', '[object Int32Array]', '[object Uint32Array]', '[object Float32Array]', '[object Float64Array]'];

        var isDataView = function isDataView(obj) {
          return obj && DataView.prototype.isPrototypeOf(obj);
        };

        var isArrayBufferView = ArrayBuffer.isView || function (obj) {
          return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1;
        };
      }

      function normalizeName(name) {
        if (typeof name !== 'string') {
          name = String(name);
        }

        if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
          throw new TypeError('Invalid character in header field name');
        }

        return name.toLowerCase();
      }

      function normalizeValue(value) {
        if (typeof value !== 'string') {
          value = String(value);
        }

        return value;
      } // Build a destructive iterator for the value list


      function iteratorFor(items) {
        var iterator = {
          next: function next() {
            var value = items.shift();
            return {
              done: value === undefined,
              value: value
            };
          }
        };

        if (support.iterable) {
          iterator[Symbol.iterator] = function () {
            return iterator;
          };
        }

        return iterator;
      }

      function Headers(headers) {
        this.map = {};

        if (headers instanceof Headers) {
          headers.forEach(function (value, name) {
            this.append(name, value);
          }, this);
        } else if (Array.isArray(headers)) {
          headers.forEach(function (header) {
            this.append(header[0], header[1]);
          }, this);
        } else if (headers) {
          Object.getOwnPropertyNames(headers).forEach(function (name) {
            this.append(name, headers[name]);
          }, this);
        }
      }

      Headers.prototype.append = function (name, value) {
        name = normalizeName(name);
        value = normalizeValue(value);
        var oldValue = this.map[name];
        this.map[name] = oldValue ? oldValue + ',' + value : value;
      };

      Headers.prototype['delete'] = function (name) {
        delete this.map[normalizeName(name)];
      };

      Headers.prototype.get = function (name) {
        name = normalizeName(name);
        return this.has(name) ? this.map[name] : null;
      };

      Headers.prototype.has = function (name) {
        return this.map.hasOwnProperty(normalizeName(name));
      };

      Headers.prototype.set = function (name, value) {
        this.map[normalizeName(name)] = normalizeValue(value);
      };

      Headers.prototype.forEach = function (callback, thisArg) {
        for (var name in this.map) {
          if (this.map.hasOwnProperty(name)) {
            callback.call(thisArg, this.map[name], name, this);
          }
        }
      };

      Headers.prototype.keys = function () {
        var items = [];
        this.forEach(function (value, name) {
          items.push(name);
        });
        return iteratorFor(items);
      };

      Headers.prototype.values = function () {
        var items = [];
        this.forEach(function (value) {
          items.push(value);
        });
        return iteratorFor(items);
      };

      Headers.prototype.entries = function () {
        var items = [];
        this.forEach(function (value, name) {
          items.push([name, value]);
        });
        return iteratorFor(items);
      };

      if (support.iterable) {
        Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
      }

      function consumed(body) {
        if (body.bodyUsed) {
          return Promise.reject(new TypeError('Already read'));
        }

        body.bodyUsed = true;
      }

      function fileReaderReady(reader) {
        return new Promise(function (resolve, reject) {
          reader.onload = function () {
            resolve(reader.result);
          };

          reader.onerror = function () {
            reject(reader.error);
          };
        });
      }

      function readBlobAsArrayBuffer(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsArrayBuffer(blob);
        return promise;
      }

      function readBlobAsText(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsText(blob);
        return promise;
      }

      function readArrayBufferAsText(buf) {
        var view = new Uint8Array(buf);
        var chars = new Array(view.length);

        for (var i = 0; i < view.length; i++) {
          chars[i] = String.fromCharCode(view[i]);
        }

        return chars.join('');
      }

      function bufferClone(buf) {
        if (buf.slice) {
          return buf.slice(0);
        } else {
          var view = new Uint8Array(buf.byteLength);
          view.set(new Uint8Array(buf));
          return view.buffer;
        }
      }

      function Body() {
        this.bodyUsed = false;

        this._initBody = function (body) {
          this._bodyInit = body;

          if (!body) {
            this._bodyText = '';
          } else if (typeof body === 'string') {
            this._bodyText = body;
          } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
            this._bodyBlob = body;
          } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
            this._bodyFormData = body;
          } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this._bodyText = body.toString();
          } else if (support.arrayBuffer && support.blob && isDataView(body)) {
            this._bodyArrayBuffer = bufferClone(body.buffer); // IE 10-11 can't handle a DataView body.

            this._bodyInit = new Blob([this._bodyArrayBuffer]);
          } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
            this._bodyArrayBuffer = bufferClone(body);
          } else {
            throw new Error('unsupported BodyInit type');
          }

          if (!this.headers.get('content-type')) {
            if (typeof body === 'string') {
              this.headers.set('content-type', 'text/plain;charset=UTF-8');
            } else if (this._bodyBlob && this._bodyBlob.type) {
              this.headers.set('content-type', this._bodyBlob.type);
            } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
              this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
            }
          }
        };

        if (support.blob) {
          this.blob = function () {
            var rejected = consumed(this);

            if (rejected) {
              return rejected;
            }

            if (this._bodyBlob) {
              return Promise.resolve(this._bodyBlob);
            } else if (this._bodyArrayBuffer) {
              return Promise.resolve(new Blob([this._bodyArrayBuffer]));
            } else if (this._bodyFormData) {
              throw new Error('could not read FormData body as blob');
            } else {
              return Promise.resolve(new Blob([this._bodyText]));
            }
          };

          this.arrayBuffer = function () {
            if (this._bodyArrayBuffer) {
              return consumed(this) || Promise.resolve(this._bodyArrayBuffer);
            } else {
              return this.blob().then(readBlobAsArrayBuffer);
            }
          };
        }

        this.text = function () {
          var rejected = consumed(this);

          if (rejected) {
            return rejected;
          }

          if (this._bodyBlob) {
            return readBlobAsText(this._bodyBlob);
          } else if (this._bodyArrayBuffer) {
            return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer));
          } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as text');
          } else {
            return Promise.resolve(this._bodyText);
          }
        };

        if (support.formData) {
          this.formData = function () {
            return this.text().then(decode);
          };
        }

        this.json = function () {
          return this.text().then(JSON.parse);
        };

        return this;
      } // HTTP methods whose capitalization should be normalized


      var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

      function normalizeMethod(method) {
        var upcased = method.toUpperCase();
        return methods.indexOf(upcased) > -1 ? upcased : method;
      }

      function Request(input, options) {
        options = options || {};
        var body = options.body;

        if (input instanceof Request) {
          if (input.bodyUsed) {
            throw new TypeError('Already read');
          }

          this.url = input.url;
          this.credentials = input.credentials;

          if (!options.headers) {
            this.headers = new Headers(input.headers);
          }

          this.method = input.method;
          this.mode = input.mode;

          if (!body && input._bodyInit != null) {
            body = input._bodyInit;
            input.bodyUsed = true;
          }
        } else {
          this.url = String(input);
        }

        this.credentials = options.credentials || this.credentials || 'omit';

        if (options.headers || !this.headers) {
          this.headers = new Headers(options.headers);
        }

        this.method = normalizeMethod(options.method || this.method || 'GET');
        this.mode = options.mode || this.mode || null;
        this.referrer = null;

        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
          throw new TypeError('Body not allowed for GET or HEAD requests');
        }

        this._initBody(body);
      }

      Request.prototype.clone = function () {
        return new Request(this, {
          body: this._bodyInit
        });
      };

      function decode(body) {
        var form = new FormData();
        body.trim().split('&').forEach(function (bytes) {
          if (bytes) {
            var split = bytes.split('=');
            var name = split.shift().replace(/\+/g, ' ');
            var value = split.join('=').replace(/\+/g, ' ');
            form.append(decodeURIComponent(name), decodeURIComponent(value));
          }
        });
        return form;
      }

      function parseHeaders(rawHeaders) {
        var headers = new Headers(); // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
        // https://tools.ietf.org/html/rfc7230#section-3.2

        var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
        preProcessedHeaders.split(/\r?\n/).forEach(function (line) {
          var parts = line.split(':');
          var key = parts.shift().trim();

          if (key) {
            var value = parts.join(':').trim();
            headers.append(key, value);
          }
        });
        return headers;
      }

      Body.call(Request.prototype);

      function Response(bodyInit, options) {
        if (!options) {
          options = {};
        }

        this.type = 'default';
        this.status = options.status === undefined ? 200 : options.status;
        this.ok = this.status >= 200 && this.status < 300;
        this.statusText = 'statusText' in options ? options.statusText : 'OK';
        this.headers = new Headers(options.headers);
        this.url = options.url || '';

        this._initBody(bodyInit);
      }

      Body.call(Response.prototype);

      Response.prototype.clone = function () {
        return new Response(this._bodyInit, {
          status: this.status,
          statusText: this.statusText,
          headers: new Headers(this.headers),
          url: this.url
        });
      };

      Response.error = function () {
        var response = new Response(null, {
          status: 0,
          statusText: ''
        });
        response.type = 'error';
        return response;
      };

      var redirectStatuses = [301, 302, 303, 307, 308];

      Response.redirect = function (url, status) {
        if (redirectStatuses.indexOf(status) === -1) {
          throw new RangeError('Invalid status code');
        }

        return new Response(null, {
          status: status,
          headers: {
            location: url
          }
        });
      };

      self.Headers = Headers;
      self.Request = Request;
      self.Response = Response;

      self.fetch = function (input, init) {
        return new Promise(function (resolve, reject) {
          var request = new Request(input, init);
          var xhr = new XMLHttpRequest();

          xhr.onload = function () {
            var options = {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: parseHeaders(xhr.getAllResponseHeaders() || '')
            };
            options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
            var body = 'response' in xhr ? xhr.response : xhr.responseText;
            resolve(new Response(body, options));
          };

          xhr.onerror = function () {
            reject(new TypeError('Network request failed'));
          };

          xhr.ontimeout = function () {
            reject(new TypeError('Network request failed'));
          };

          xhr.open(request.method, request.url, true);

          if (request.credentials === 'include') {
            xhr.withCredentials = true;
          } else if (request.credentials === 'omit') {
            xhr.withCredentials = false;
          }

          if ('responseType' in xhr && support.blob) {
            xhr.responseType = 'blob';
          }

          request.headers.forEach(function (value, name) {
            xhr.setRequestHeader(name, value);
          });
          xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
        });
      };

      self.fetch.polyfill = true;
    })(typeof self !== 'undefined' ? self : this);
  }
}).call('object' === (typeof window === "undefined" ? "undefined" : _typeof(window)) && window || 'object' === (typeof self === "undefined" ? "undefined" : _typeof(self)) && self || 'object' === (typeof global === "undefined" ? "undefined" : _typeof(global)) && global || {});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
"use strict";

require('./imports/_polyfills'); // Following is used to fix Bootstrap Native Carousel in IE 10.
// IE 10 doesn't support touch events and polyfill.io doesn't
// have stub, so we're using standalone polyfill.
//


require('touchr');

},{"./imports/_polyfills":2,"touchr":1}]},{},[3]);

//# sourceMappingURL=polyfills.js.map
