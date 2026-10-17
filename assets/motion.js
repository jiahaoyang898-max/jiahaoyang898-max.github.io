/* System Dossier — motion layer
   Vanilla JS, zero dependencies. Every hook is optional: missing nodes never throw.

   Hooks:
   .reveal / --d        scroll reveal (once)
   [data-count]         count-up (keeps prefix / suffix / thousand separators)
   .nav-item[data-sec]  scrollspy
   .magnetic            pointer magnet (fine pointers only)
   .cursor-dot/.cursor-ring + .cursor-ring.grow
   #motionBtn/#motionLabel, #clock, .copy-mail, #toast
   ?shot=1, ?view=<section>, ?demo=feature|ecom
*/
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Helpers / environment                                               */
  /* ------------------------------------------------------------------ */

  var root = document.documentElement;
  var requestFrame = typeof window.requestAnimationFrame === 'function'
    ? function (fn) { return window.requestAnimationFrame(fn); }
    : function (fn) { return window.setTimeout(function () { fn(Date.now()); }, 16); };
  var cancelFrame = typeof window.cancelAnimationFrame === 'function'
    ? function (id) { window.cancelAnimationFrame(id); }
    : function (id) { window.clearTimeout(id); };

  function queryAll(selector, scope) {
    try {
      return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  function queryOne(selector, scope) {
    try {
      return (scope || document).querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  function listen(target, type, fn, options) {
    if (!target || typeof target.addEventListener !== 'function') return;
    try {
      target.addEventListener(type, fn, options || false);
    } catch (e) {
      try { target.addEventListener(type, fn, false); } catch (e2) {}
    }
  }

  function hasClass(el, name) {
    return !!(el && el.classList && el.classList.contains(name));
  }

  function decodePart(value) {
    var text = String(value == null ? '' : value).replace(/\+/g, ' ');
    try { return decodeURIComponent(text); } catch (e) { return text; }
  }

  function readParams() {
    var result = {};
    var search = window.location && window.location.search ? window.location.search : '';
    if (search.charAt(0) === '?') search = search.slice(1);
    if (!search) return result;
    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      var eq = pairs[i].indexOf('=');
      var key = decodePart(eq === -1 ? pairs[i] : pairs[i].slice(0, eq));
      if (!key || Object.prototype.hasOwnProperty.call(result, key)) continue;
      result[key] = decodePart(eq === -1 ? '' : pairs[i].slice(eq + 1));
    }
    return result;
  }

  function closestElement(node, selector) {
    var el = node;
    while (el && el.nodeType !== 1) el = el.parentNode;
    while (el && el.nodeType === 1) {
      var matches = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
      if (matches) {
        try { if (matches.call(el, selector)) return el; } catch (e) {}
      }
      el = el.parentElement || el.parentNode;
    }
    return null;
  }

  function mediaQuery(value) {
    try {
      return typeof window.matchMedia === 'function' ? window.matchMedia(value) : null;
    } catch (e) {
      return null;
    }
  }

  function finePointer() {
    if (fineQuery) return !!fineQuery.matches;
    return !('ontouchstart' in window);
  }

  function reducedNow() {
    return !!(reduceQuery && reduceQuery.matches);
  }

  function loadMotionPreference() {
    try {
      var value = window.localStorage.getItem('yjh-motion');
      if (value === 'off' || value === '0' || value === 'false') return false;
      if (value === 'on' || value === '1' || value === 'true') return true;
    } catch (e) {}
    return true;
  }

  function saveMotionPreference(on) {
    try { window.localStorage.setItem('yjh-motion', on ? 'on' : 'off'); } catch (e) {}
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /* ------------------------------------------------------------------ */
  /* URL flags / initial state                                           */
  /* ------------------------------------------------------------------ */

  var params = readParams();
  var shotMode = params.shot === '1' || params.shot === 'true';
  var demoName = String(params.demo || '').trim().toLowerCase();
  var viewName = String(params.view || '').trim().toLowerCase();
  var reduceQuery = mediaQuery('(prefers-reduced-motion: reduce)');
  var fineQuery = mediaQuery('(pointer: fine)');
  var enabled = loadMotionPreference() && !(reduceQuery && reduceQuery.matches);

  var initialized = false;
  var toastTimer = 0;
  var clockStarted = false;

  if (shotMode) root.classList.add('shot');
  syncMotionUI();

  /* ------------------------------------------------------------------ */
  /* 1. Scroll reveal                                                    */
  /* ------------------------------------------------------------------ */

  var revealObserver = null;
  var observedReveals = [];

  function revealElement(el, useDelay) {
    if (!el || !el.classList || hasClass(el, 'in')) return;
    if (useDelay) {
      var delay = '';
      try { delay = el.style.getPropertyValue('--d') || ''; } catch (e) {}
      delay = String(delay).replace(/^\s+|\s+$/g, '');
      if (delay) el.style.transitionDelay = delay;
    }
    el.classList.add('in');
  }

  function disconnectRevealObserver() {
    if (!revealObserver) return;
    try { revealObserver.disconnect(); } catch (e) {}
    revealObserver = null;
  }

  function revealAll(useDelay) {
    var nodes = queryAll('.reveal');
    for (var i = 0; i < nodes.length; i++) revealElement(nodes[i], !!useDelay);
    disconnectRevealObserver();
  }

  function getRevealObserver() {
    if (revealObserver) return revealObserver;
    if (typeof window.IntersectionObserver !== 'function') return null;
    try {
      var observer = new window.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (!entry || !entry.isIntersecting) continue;
          revealElement(entry.target, true);
          try { observer.unobserve(entry.target); } catch (e) {}
        }
      }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
      revealObserver = observer;
    } catch (e) {
      revealObserver = null;
    }
    return revealObserver;
  }

  function setupReveals() {
    var nodes = queryAll('.reveal');
    if (!enabled || shotMode) {
      revealAll(false);
      return;
    }

    var observer = getRevealObserver();
    if (!observer) {
      revealAll(true);
      return;
    }

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (hasClass(el, 'in') || observedReveals.indexOf(el) !== -1) continue;
      observedReveals.push(el);
      try {
        observer.observe(el);
      } catch (e) {
        revealElement(el, true);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. Count-up                                                         */
  /* ------------------------------------------------------------------ */

  var NUMBER_PATTERN = /[-+]?\d[\d,]*(?:\.\d+)?/;
  var counterRecords = [];
  var seenCounters = [];
  var counterObserver = null;

  function hasCounterDecoration(source, match) {
    var rest = source.slice(0, match.index) + source.slice(match.index + match[0].length);
    rest = rest.replace(/[\s,]/g, '');
    return rest.length > 0;
  }

  function parseCounter(el) {
    var attr = el.getAttribute('data-count');
    var text = el.textContent || '';
    var attrMatch = attr != null ? NUMBER_PATTERN.exec(attr) : null;
    var textMatch = NUMBER_PATTERN.exec(text);
    var match = attrMatch || textMatch;
    if (!match) return null;

    var token = match[0];
    var value = parseFloat(token.replace(/,/g, ''));
    if (!isFinite(value)) return null;

    var prefix = '';
    var suffix = '';

    if (textMatch && hasCounterDecoration(text, textMatch)) {
      prefix = text.slice(0, textMatch.index);
      suffix = text.slice(textMatch.index + textMatch[0].length);
    } else if (attrMatch) {
      prefix = attr.slice(0, attrMatch.index);
      suffix = attr.slice(attrMatch.index + attrMatch[0].length);
    } else if (textMatch) {
      prefix = text.slice(0, textMatch.index);
      suffix = text.slice(textMatch.index + textMatch[0].length);
    }

    var grouping = token.indexOf(',') !== -1 ||
      !!(textMatch && textMatch[0].indexOf(',') !== -1);
    var dot = token.indexOf('.');
    var decimals = dot === -1 ? 0 : Math.min(6, token.length - dot - 1);

    return {
      value: value,
      decimals: decimals,
      grouping: grouping,
      prefix: prefix,
      suffix: suffix
    };
  }

  function formatCounter(value, decimals, grouping) {
    var number = Number(value);
    if (!isFinite(number)) number = 0;
    var fixed = Math.abs(number).toFixed(decimals);
    var chunks = fixed.split('.');
    var whole = chunks[0];
    if (grouping) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var sign = number < 0 && parseFloat(fixed) !== 0 ? '-' : '';
    return sign + whole + (decimals > 0 ? '.' + chunks[1] : '');
  }

  function counterLabel(rec, value) {
    return rec.data.prefix + formatCounter(value, rec.data.decimals, rec.data.grouping) + rec.data.suffix;
  }

  function finishCounter(rec) {
    if (!rec || rec.done) return;
    rec.done = true;
    rec.running = false;
    if (rec.rafId) {
      cancelFrame(rec.rafId);
      rec.rafId = 0;
    }
    rec.el.textContent = counterLabel(rec, rec.data.value);
  }

  function finishAllCounters() {
    for (var i = 0; i < counterRecords.length; i++) finishCounter(counterRecords[i]);
    if (counterObserver) {
      try { counterObserver.disconnect(); } catch (e) {}
      counterObserver = null;
    }
  }

  function findCounterRecord(el) {
    for (var i = 0; i < counterRecords.length; i++) {
      if (counterRecords[i].el === el) return counterRecords[i];
    }
    return null;
  }

  function animateCounter(rec) {
    if (!rec || rec.done || rec.running) return;
    rec.running = true;
    rec.el.textContent = counterLabel(rec, 0);

    var startTime = null;
    var duration = 1300;

    function frame(now) {
      if (rec.done) {
        rec.running = false;
        rec.rafId = 0;
        return;
      }
      if (startTime === null) startTime = now;
      var progress = (now - startTime) / duration;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      var eased = 1 - Math.pow(1 - progress, 3);
      rec.el.textContent = counterLabel(rec, rec.data.value * eased);

      if (progress < 1) {
        rec.rafId = requestFrame(frame);
      } else {
        rec.running = false;
        rec.rafId = 0;
        finishCounter(rec);
      }
    }

    rec.rafId = requestFrame(frame);
  }

  function getCounterObserver() {
    if (counterObserver) return counterObserver;
    if (typeof window.IntersectionObserver !== 'function') return null;
    try {
      var observer = new window.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (!entry || !entry.isIntersecting) continue;
          try { observer.unobserve(entry.target); } catch (e) {}
          var rec = findCounterRecord(entry.target);
          if (rec && !rec.done) animateCounter(rec);
        }
      }, { threshold: 0.15, rootMargin: '0px 0px -4% 0px' });
      counterObserver = observer;
    } catch (e) {
      counterObserver = null;
    }
    return counterObserver;
  }

  function setupCounters() {
    var nodes = queryAll('[data-count]');
    var canAnimate = enabled && !shotMode && !reducedNow();
    var observer = canAnimate ? getCounterObserver() : null;

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (seenCounters.indexOf(el) !== -1) continue;
      seenCounters.push(el);

      var data = parseCounter(el);
      if (!data) continue;

      var rec = { el: el, data: data, done: false, running: false, rafId: 0 };
      counterRecords.push(rec);

      if (!observer) {
        finishCounter(rec);
        continue;
      }

      rec.el.textContent = counterLabel(rec, 0);
      try {
        observer.observe(rec.el);
      } catch (e) {
        finishCounter(rec);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 3. Scrollspy                                                        */
  /* ------------------------------------------------------------------ */

  var spyNavs = [];
  var spySections = [];
  var spyTick = false;
  var spyListening = false;

  function requestSpyUpdate() {
    if (spyTick) return;
    spyTick = true;
    requestFrame(updateSpy);
  }

  function scrollTop() {
    if (typeof window.pageYOffset === 'number') return window.pageYOffset;
    return root.scrollTop || (document.body ? document.body.scrollTop : 0) || 0;
  }

  function updateSpy() {
    spyTick = false;

    if (!spyNavs.length || !spySections.length) {
      for (var n = 0; n < spyNavs.length; n++) {
        if (spyNavs[n].classList) spyNavs[n].classList.remove('active');
      }
      return;
    }

    var viewport = window.innerHeight || root.clientHeight || 0;
    var pageHeight = Math.max(
      root.scrollHeight || 0,
      document.body ? document.body.scrollHeight : 0
    );
    var top = scrollTop();
    var atBottom = pageHeight > viewport + 2 && top + viewport >= pageHeight - 2;
    var probe = Math.max(80, viewport * 0.35);
    var activeId = null;
    var bestTop = -Infinity;

    for (var i = 0; i < spySections.length; i++) {
      var section = spySections[i];
      var rect = section.el.getBoundingClientRect();
      if (!rect || rect.height <= 0) continue;
      if (atBottom) {
        if (rect.top > bestTop) {
          bestTop = rect.top;
          activeId = section.id;
        }
      } else if (rect.top <= probe && rect.top > bestTop) {
        bestTop = rect.top;
        activeId = section.id;
      }
    }

    for (var j = 0; j < spyNavs.length; j++) {
      var nav = spyNavs[j];
      var shouldBeActive = nav.getAttribute('data-sec') === activeId;
      if (!nav.classList) continue;
      if (shouldBeActive) {
        if (!nav.classList.contains('active')) nav.classList.add('active');
        if (nav.getAttribute('aria-current') !== 'page') nav.setAttribute('aria-current', 'page');
      } else if (nav.classList.contains('active')) {
        nav.classList.remove('active');
        nav.removeAttribute('aria-current');
      }
    }
  }

  function setupScrollspy() {
    if (!spyListening) {
      spyListening = true;
      listen(window, 'scroll', requestSpyUpdate, { passive: true });
      listen(window, 'resize', requestSpyUpdate, { passive: true });
      listen(window, 'load', requestSpyUpdate, { passive: true });
    }

    spyNavs = queryAll('.nav-item[data-sec]');
    spySections = [];
    var seenIds = {};

    for (var i = 0; i < spyNavs.length; i++) {
      var id = spyNavs[i].getAttribute('data-sec');
      if (!id || seenIds[id]) continue;
      var section = document.getElementById(id);
      if (!section) continue;
      seenIds[id] = true;
      spySections.push({ id: id, el: section });
    }

    updateSpy();
  }

  /* ------------------------------------------------------------------ */
  /* 4. Magnetic buttons                                                 */
  /* ------------------------------------------------------------------ */

  var magnets = [];
  var boundMagnets = [];

  function canMagnetize() {
    return enabled && finePointer() && !reducedNow();
  }

  function paintMagnet(item) {
    if (!canMagnetize() || !item.active) return;
    var rect = item.el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var dx = ((item.x - rect.left - rect.width / 2) / (rect.width / 2)) * 6;
    var dy = ((item.y - rect.top - rect.height / 2) / (rect.height / 2)) * 6;
    dx = clamp(dx, -6, 6);
    dy = clamp(dy, -6, 6);

    // The CSS `translate` property composes with the button's hover transform.
    item.el.style.translate = dx.toFixed(2) + 'px ' + dy.toFixed(2) + 'px';
  }

  function onMagnetMove(item, event) {
    if (!canMagnetize()) return;
    if (event.pointerType && event.pointerType !== 'mouse') return;

    item.x = event.clientX;
    item.y = event.clientY;
    item.active = true;

    if (item.rafId) return;
    item.rafId = requestFrame(function () {
      item.rafId = 0;
      paintMagnet(item);
    });
  }

  function resetMagnet(item) {
    item.active = false;
    if (item.rafId) {
      cancelFrame(item.rafId);
      item.rafId = 0;
    }
    if (item.el && item.el.style) item.el.style.translate = '';
  }

  function resetAllMagnets() {
    for (var i = 0; i < magnets.length; i++) resetMagnet(magnets[i]);
  }

  function setupMagnets() {
    var nodes = queryAll('.magnetic');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (boundMagnets.indexOf(el) !== -1) continue;
      boundMagnets.push(el);

      var item = { el: el, x: 0, y: 0, active: false, rafId: 0 };
      magnets.push(item);

      (function (magnet) {
        listen(magnet.el, 'pointermove', function (event) {
          onMagnetMove(magnet, event);
        }, { passive: true });
        listen(magnet.el, 'pointerleave', function () {
          resetMagnet(magnet);
        }, { passive: true });
        listen(magnet.el, 'pointercancel', function () {
          resetMagnet(magnet);
        }, { passive: true });
      })(item);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 5. Custom cursor                                                    */
  /* ------------------------------------------------------------------ */

  var cursorDot = null;
  var cursorRing = null;
  var cursorBound = false;
  var cursor = {
    x: 0,
    y: 0,
    ringX: 0,
    ringY: 0,
    rafId: 0,
    ready: false,
    shown: false,
    hover: false
  };

  function cursorAllowed() {
    return enabled && !shotMode && finePointer() && !reducedNow();
  }

  function setCursorVisible(visible) {
    var next = !!visible && cursorAllowed();
    if (cursorDot) cursorDot.style.opacity = next ? '1' : '0';
    if (cursorRing) cursorRing.style.opacity = next ? '1' : '0';
    cursor.shown = next;
  }

  function setCursorHover(hover) {
    cursor.hover = !!hover;
    if (!cursorRing || !cursorRing.classList) return;
    if (cursor.hover) cursorRing.classList.add('grow');
    else cursorRing.classList.remove('grow');
  }

  function hideCursor() {
    if (cursor.rafId) {
      cancelFrame(cursor.rafId);
      cursor.rafId = 0;
    }
    setCursorVisible(false);
    setCursorHover(false);
  }

  function cursorFrame() {
    cursor.rafId = 0;
    if (!cursorAllowed() || !cursor.ready) return;

    var dx = cursor.x - cursor.ringX;
    var dy = cursor.y - cursor.ringY;
    if (Math.abs(dx) < 0.1) cursor.ringX = cursor.x;
    else cursor.ringX += dx * 0.18;
    if (Math.abs(dy) < 0.1) cursor.ringY = cursor.y;
    else cursor.ringY += dy * 0.18;

    // CSS gives both elements negative margins, so translation alone centers them.
    if (cursorDot) {
      cursorDot.style.transform = 'translate3d(' + cursor.x.toFixed(2) + 'px,' + cursor.y.toFixed(2) + 'px,0)';
    }
    if (cursorRing) {
      cursorRing.style.transform = 'translate3d(' + cursor.ringX.toFixed(2) + 'px,' + cursor.ringY.toFixed(2) + 'px,0)';
    }

    if (Math.abs(cursor.x - cursor.ringX) > 0.1 || Math.abs(cursor.y - cursor.ringY) > 0.1) {
      cursor.rafId = requestFrame(cursorFrame);
    }
  }

  function scheduleCursorFrame() {
    if (!cursor.rafId) cursor.rafId = requestFrame(cursorFrame);
  }

  function onCursorMove(event) {
    if (!cursorAllowed()) {
      if (cursor.shown || cursor.hover) hideCursor();
      return;
    }
    if (event.pointerType && event.pointerType !== 'mouse') {
      hideCursor();
      return;
    }

    if (!cursor.ready) {
      cursor.ready = true;
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      cursor.ringX = event.clientX;
      cursor.ringY = event.clientY;
    } else {
      cursor.x = event.clientX;
      cursor.y = event.clientY;
    }

    setCursorHover(!!closestElement(event.target, 'a, button, [data-cursor]'));
    setCursorVisible(true);
    scheduleCursorFrame();
  }

  function setupCursor() {
    cursorDot = queryOne('.cursor-dot');
    cursorRing = queryOne('.cursor-ring');
    if (!cursorDot && !cursorRing) return;

    if (cursorDot) {
      cursorDot.style.opacity = '0';
      cursorDot.style.pointerEvents = 'none';
    }
    if (cursorRing) {
      cursorRing.style.opacity = '0';
      cursorRing.style.pointerEvents = 'none';
    }

    if (shotMode) {
      if (cursorDot) cursorDot.style.display = 'none';
      if (cursorRing) cursorRing.style.display = 'none';
    }

    if (cursorBound) return;
    cursorBound = true;

    listen(document, 'pointermove', onCursorMove, { passive: true });
    listen(document, 'mouseout', function (event) {
      if (!event.relatedTarget && !event.toElement) hideCursor();
    }, { passive: true });
    listen(window, 'blur', hideCursor, { passive: true });
    listen(document, 'visibilitychange', function () {
      if (document.hidden) hideCursor();
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* 6. Motion switch                                                    */
  /* ------------------------------------------------------------------ */

  function syncMotionUI() {
    if (enabled) root.classList.remove('no-motion');
    else root.classList.add('no-motion');

    var label = document.getElementById('motionLabel');
    if (label) label.textContent = enabled ? 'MOTION ON' : 'MOTION OFF';

    var button = document.getElementById('motionBtn');
    if (button) button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function toggleMotion() {
    enabled = !enabled;
    saveMotionPreference(enabled);
    syncMotionUI();

    if (enabled) {
      setupReveals();
      setupCounters();
    } else {
      setupReveals();
      setupCounters();
      finishAllCounters();
      hideCursor();
      resetAllMagnets();
    }
  }

  function setupMotionButton() {
    var button = document.getElementById('motionBtn');
    if (!button) return;
    listen(button, 'click', function (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      toggleMotion();
    }, false);
  }

  /* ------------------------------------------------------------------ */
  /* 7. Asia/Shanghai clock                                              */
  /* ------------------------------------------------------------------ */

  var shanghaiFormatter = null;
  var formatterBroken = false;

  function pad2(value) {
    var number = parseInt(value, 10);
    if (!isFinite(number)) number = 0;
    return (number < 10 ? '0' : '') + number;
  }

  function shanghaiTime(date) {
    if (!formatterBroken && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      try {
        if (!shanghaiFormatter) {
          shanghaiFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Shanghai',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }

        var hour = null;
        var minute = null;
        if (typeof shanghaiFormatter.formatToParts === 'function') {
          var parts = shanghaiFormatter.formatToParts(date);
          for (var i = 0; i < parts.length; i++) {
            if (parts[i].type === 'hour') hour = parseInt(parts[i].value, 10);
            if (parts[i].type === 'minute') minute = parseInt(parts[i].value, 10);
          }
        } else {
          var match = /(\d{1,2}):(\d{2})/.exec(shanghaiFormatter.format(date));
          if (match) {
            hour = parseInt(match[1], 10);
            minute = parseInt(match[2], 10);
          }
        }
        if (hour !== null && minute !== null && isFinite(hour) && isFinite(minute)) {
          hour = hour % 24;
          return pad2(hour) + ':' + pad2(minute);
        }
      } catch (e) {
        formatterBroken = true;
        shanghaiFormatter = null;
      }
    }

    // Fallback: China Standard Time has no DST.
    var shifted = new Date(date.getTime() + (date.getTimezoneOffset() + 8 * 60) * 60000);
    return pad2(shifted.getHours()) + ':' + pad2(shifted.getMinutes());
  }

  function updateClock() {
    var clock = document.getElementById('clock');
    if (clock) clock.textContent = shanghaiTime(new Date());
  }

  function scheduleClock() {
    var now = new Date();
    var wait = 60000 - ((now.getSeconds() * 1000) + now.getMilliseconds()) + 25;
    if (wait < 100) wait = 100;
    window.setTimeout(function () {
      updateClock();
      scheduleClock();
    }, wait);
  }

  function startClock() {
    updateClock();
    if (clockStarted) return;
    clockStarted = true;
    scheduleClock();
    listen(document, 'visibilitychange', function () {
      if (!document.hidden) updateClock();
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* 8. Email copy + toast                                               */
  /* ------------------------------------------------------------------ */

  function showToast(ok) {
    var toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = ok ? '邮箱已复制' : '复制失败，请手动复制';
    toast.classList.add('show');

    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = 0;
      if (toast && toast.classList) toast.classList.remove('show');
    }, 1800);
  }

  function legacyCopy(text) {
    var body = document.body;
    if (!body) return false;

    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '-9999px';
    area.style.width = '1px';
    area.style.height = '1px';
    area.style.padding = '0';
    area.style.border = '0';
    area.style.opacity = '0';

    var focused = document.activeElement;
    var copied = false;

    body.appendChild(area);
    try {
      area.focus();
      area.select();
      if (typeof area.setSelectionRange === 'function') {
        area.setSelectionRange(0, area.value.length);
      }
      copied = typeof document.execCommand === 'function'
        ? document.execCommand('copy')
        : false;
    } catch (e) {
      copied = false;
    }

    try { body.removeChild(area); } catch (e) {}
    if (focused && typeof focused.focus === 'function') {
      try { focused.focus(); } catch (e) {}
    }

    return !!copied;
  }

  function copyText(text, done) {
    var settled = false;

    function finish(ok) {
      if (settled) return;
      settled = true;
      done(!!ok);
    }

    function fallback() {
      finish(legacyCopy(text));
    }

    try {
      var clipboard = navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function' && window.isSecureContext !== false) {
        var promise = clipboard.writeText(text);
        if (promise && typeof promise.then === 'function') {
          promise.then(function () { finish(true); }, fallback);
          return;
        }
      }
    } catch (e) {}

    fallback();
  }

  function emailFrom(el) {
    function decodeAddress(value) {
      var text = String(value == null ? '' : value);
      try { return decodeURIComponent(text); } catch (e) { return text; }
    }

    var href = el.getAttribute('href') || '';
    if (/^mailto:/i.test(href)) {
      var address = href.slice(7).split('?')[0].split('#')[0];
      address = decodeAddress(address).replace(/^\s+|\s+$/g, '');
      if (address) return address;
    }

    var dataEmail = el.getAttribute('data-email') || '';
    return decodeAddress(dataEmail).replace(/^\s+|\s+$/g, '');
  }

  var boundCopies = [];

  function setupCopies() {
    var nodes = queryAll('.copy-mail');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (boundCopies.indexOf(el) !== -1) continue;
      boundCopies.push(el);

      (function (button) {
        listen(button, 'click', function (event) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          var email = emailFrom(button);
          if (!email) {
            showToast(false);
            return;
          }
          copyText(email, showToast);
        }, false);
      })(el);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 8b. G: baseline grid overlay (print-proof easter egg)               */
  /* ------------------------------------------------------------------ */

  function setupGridToggle() {
    listen(document, 'keydown', function (event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      var target = event.target;
      var tag = target && target.tagName ? String(target.tagName).toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) return;
      if (event.key === 'Escape') {
        root.classList.remove('grid-on');
        return;
      }
      if (event.key === 'g' || event.key === 'G') root.classList.toggle('grid-on');
    }, false);
  }

  /* ------------------------------------------------------------------ */
  /* 9. Screenshot / view / demo URL flags                               */
  /* ------------------------------------------------------------------ */

  var VIEW_IDS = {
    modules: true,
    stack: true,
    adr: true,
    evidence: true,
    compare: true,
    profile: true,
    route: true,
    home: true
  };

  function applyDemoParam() {
    if (demoName !== 'feature' && demoName !== 'ecom') return;
    var target = document.getElementById(demoName);
    if (target) target.classList.add('is-hover');
  }

  function applyViewParam() {
    if (!viewName || !Object.prototype.hasOwnProperty.call(VIEW_IDS, viewName)) return;

    window.setTimeout(function () {
      var target = document.getElementById(viewName);
      if (!target) return;

      try {
        root.style.scrollBehavior = 'auto';
        if (document.body) document.body.style.scrollBehavior = 'auto';

        var y = target.getBoundingClientRect().top + scrollTop() - 20;
        if (y < 0) y = 0;
        window.scrollTo(0, y);
      } catch (e) {
        try {
          window.scrollTo(0, Math.max(0, target.offsetTop - 20));
        } catch (e2) {}
      }

      updateSpy();
    }, 80);
  }

  /* ------------------------------------------------------------------ */
  /* 12. Public API / init                                               */
  /* ------------------------------------------------------------------ */

  function dispatchReady() {
    var detail = { refresh: refresh };
    var event = null;

    try {
      if (typeof window.CustomEvent === 'function') {
        event = new window.CustomEvent('portfolio:motion-ready', {
          bubbles: true,
          detail: detail
        });
      } else if (document.createEvent) {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('portfolio:motion-ready', true, false, detail);
      }
    } catch (e) {
      event = null;
    }

    if (!event) {
      try {
        event = document.createEvent('Event');
        event.initEvent('portfolio:motion-ready', true, false);
      } catch (e2) {
        return;
      }
    }

    try { document.dispatchEvent(event); } catch (e3) {}
  }

  function refresh() {
    if (!initialized) return;
    setupReveals();
    setupCounters();
    setupScrollspy();
  }

  function init() {
    if (initialized) return;
    initialized = true;

    syncMotionUI();
    applyDemoParam();

    setupReveals();
    setupCounters();
    setupScrollspy();
    setupMagnets();
    setupCursor();
    setupCopies();
    setupMotionButton();
    setupGridToggle();
    startClock();
    applyViewParam();
    dispatchReady();
  }

  window.PortfolioMotion = { refresh: refresh };

  if (document.readyState === 'loading') {
    listen(document, 'DOMContentLoaded', init, false);
  } else {
    init();
  }
})();
