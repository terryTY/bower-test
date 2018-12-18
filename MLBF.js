/**
 * Sea.js 3.0.0 | seajs.org/LICENSE.md
 */
(function(global, undefined) {

    // Avoid conflicting when `sea.js` is loaded multiple times
    if (global.MLBF) {
        return
    }

    var MLBF = global.MLBF = {
        // The current version of Sea.js being used
        version: "3.0.0"
    }

    var data = MLBF.data = {}


    /**
     * util-lang.js - The minimal language enhancement
     */

    function isType(type) {
        return function(obj) {
            return {}.toString.call(obj) == "[object " + type + "]"
        }
    }

    var isObject = isType("Object")
    var isString = isType("String")
    var isArray = Array.isArray || isType("Array")
    var isFunction = isType("Function")

    var _cid = 0

    function cid() {
        return _cid++
    }


    /**
     * util-events.js - The minimal events support
     */

    var events = data.events = {}

    // Bind event
    MLBF.on = function(name, callback) {
        var list = events[name] || (events[name] = [])
        list.push(callback)
        return MLBF
    }

    // Remove event. If `callback` is undefined, remove all callbacks for the
    // event. If `event` and `callback` are both undefined, remove all callbacks
    // for all events
    MLBF.off = function(name, callback) {
        // Remove *all* events
        if (!(name || callback)) {
            events = data.events = {}
            return MLBF
        }

        var list = events[name]
        if (list) {
            if (callback) {
                for (var i = list.length - 1; i >= 0; i--) {
                    if (list[i] === callback) {
                        list.splice(i, 1)
                    }
                }
            } else {
                delete events[name]
            }
        }

        return MLBF
    }

    // Emit event, firing all bound callbacks. Callbacks receive the same
    // arguments as `emit` does, apart from the event name
    var emit = MLBF.emit = function(name, data) {
        var list = events[name]

        if (list) {
            // Copy callback lists to prevent modification
            list = list.slice()

            // Execute event callbacks, use index because it's the faster.
            for (var i = 0, len = list.length; i < len; i++) {
                list[i](data)
            }
        }

        return MLBF
    }

    /**
     * util-path.js - The utilities for operating path such as id, uri
     */

    var DIRNAME_RE = /[^?#]*\//

    var DOT_RE = /\/\.\//g
    var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//
    var MULTI_SLASH_RE = /([^:/])\/+\//g

    // Extract the directory portion of a path
    // dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
    // ref: http://jsperf.com/regex-vs-split/2
    function dirname(path) {
        return path.match(DIRNAME_RE)[0]
    }

    // Canonicalize a path
    // realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
    function realpath(path) {
        // /a/b/./c/./d ==> /a/b/c/d
        path = path.replace(DOT_RE, "/")

        /*
          @author wh1100717
          a//b/c ==> a/b/c
          a///b/////c ==> a/b/c
          DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
        */
        path = path.replace(MULTI_SLASH_RE, "$1/")

        // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
        while (path.match(DOUBLE_DOT_RE)) {
            path = path.replace(DOUBLE_DOT_RE, "/")
        }

        return path
    }

    // Normalize an id
    // normalize("path/to/a") ==> "path/to/a.js"
    // NOTICE: substring is faster than negative slice and RegExp
    function normalize(path) {
        var last = path.length - 1
        var lastC = path.charCodeAt(last)

        // If the uri ends with `#`, just return it without '#'
        if (lastC === 35 /* "#" */ ) {
            return path.substring(0, last)
        }

        // add css by hongri
        return ((path.substring(last - 2) === ".js" || path.substring(last - 3) === ".css") ||
            path.indexOf("?") > 0 ||
            lastC === 47 /* "/" */ ) ? path : path + ".js"
    }


    var PATHS_RE = /^([^/:]+)(\/.+)$/
    var VARS_RE = /{([^{]+)}/g

    function parseAlias(id) {
        var alias = data.alias
        return alias && isString(alias[id]) ? alias[id] : id
    }

    function parsePaths(id) {
        var paths = data.paths
        var m

        if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
            id = paths[m[1]] + m[2]
        }

        return id
    }

    function parseVars(id) {
        var vars = data.vars

        if (vars && id.indexOf("{") > -1) {
            id = id.replace(VARS_RE, function(m, key) {
                return isString(vars[key]) ? vars[key] : m
            })
        }

        return id
    }

    function parseMap(uri) {
        var map = data.map
        var ret = uri

        if (map) {
            for (var i = 0, len = map.length; i < len; i++) {
                var rule = map[i]

                ret = isFunction(rule) ?
                    (rule(uri) || uri) :
                    uri.replace(rule[0], rule[1])

                // Only apply the first matched rule
                if (ret !== uri) break
            }
        }

        return ret
    }


    var ABSOLUTE_RE = /^\/\/.|:\//
    var ROOT_DIR_RE = /^.*?\/\/.*?\//

    function addBase(id, refUri) {
        var ret
        var first = id.charCodeAt(0)

        // Absolute
        if (ABSOLUTE_RE.test(id)) {
            ret = id
        }
        // Relative
        else if (first === 46 /* "." */ ) {
            ret = (refUri ? dirname(refUri) : data.cwd) + id
        }
        // Root
        else if (first === 47 /* "/" */ ) {
            var m = data.cwd.match(ROOT_DIR_RE)
            ret = m ? m[0] + id.substring(1) : id
        }
        // Top-level
        else {
            ret = data.base + id
        }

        // Add default protocol when uri begins with "//"
        if (ret.indexOf("//") === 0) {
            ret = location.protocol + ret
        }

        return realpath(ret)
    }

    function id2Uri(id, refUri) {
        if (!id) return ""

        id = parseAlias(id)
        id = parsePaths(id)
        id = parseAlias(id)
        id = parseVars(id)
        id = parseAlias(id)
        id = normalize(id)
        id = parseAlias(id)

        var uri = addBase(id, refUri)
        uri = parseAlias(uri)
        uri = parseMap(uri)

        return uri
    }

    // For Developers
    MLBF.resolve = id2Uri;

    // Check environment
    var isWebWorker = typeof window === 'undefined' && typeof importScripts !== 'undefined' && isFunction(importScripts);
    var isOldWebKit = +navigator.userAgent.replace(/.*(?:AppleWebKit|AndroidWebKit)\/(\d+).*/, "$1") < 536;

    // add by hongri
    var IS_CSS_RE = /\.css(?:\?|$)/i;

    // Ignore about:xxx and blob:xxx
    var IGNORE_LOCATION_RE = /^(about|blob):/;
    var loaderDir;
    // Sea.js's full path
    var loaderPath;
    // Location is read-only from web worker, should be ok though
    var cwd = (!location.href || IGNORE_LOCATION_RE.test(location.href)) ? '' : dirname(location.href);

    if (isWebWorker) {
        // Web worker doesn't create DOM object when loading scripts
        // Get sea.js's path by stack trace.
        var stack;
        try {
            var up = new Error();
            throw up;
        } catch (e) {
            // IE won't set Error.stack until thrown
            stack = e.stack.split('\n');
        }
        // First line is 'Error'
        stack.shift();

        var m;
        // Try match `url:row:col` from stack trace line. Known formats:
        // Chrome:  '    at http://localhost:8000/script/sea-worker-debug.js:294:25'
        // FireFox: '@http://localhost:8000/script/sea-worker-debug.js:1082:1'
        // IE11:    '   at Anonymous function (http://localhost:8000/script/sea-worker-debug.js:295:5)'
        // Don't care about older browsers since web worker is an HTML5 feature
        var TRACE_RE = /.*?((?:http|https|file)(?::\/{2}[\w]+)(?:[\/|\.]?)(?:[^\s"]*)).*?/i
            // Try match `url` (Note: in IE there will be a tailing ')')
        var URL_RE = /(.*?):\d+:\d+\)?$/;
        // Find url of from stack trace.
        // Cannot simply read the first one because sometimes we will get:
        // Error
        //  at Error (native) <- Here's your problem
        //  at http://localhost:8000/_site/dist/sea.js:2:4334 <- What we want
        //  at http://localhost:8000/_site/dist/sea.js:2:8386
        //  at http://localhost:8000/_site/tests/specs/web-worker/worker.js:3:1
        while (stack.length > 0) {
            var top = stack.shift();
            m = TRACE_RE.exec(top);
            if (m != null) {
                break;
            }
        }
        var url;
        if (m != null) {
            // Remove line number and column number
            // No need to check, can't be wrong at this point
            var url = URL_RE.exec(m[1])[1];
        }
        // Set
        loaderPath = url
            // Set loaderDir
        loaderDir = dirname(url || cwd);
        // This happens with inline worker.
        // When entrance script's location.href is a blob url,
        // cwd will not be available.
        // Fall back to loaderDir.
        if (cwd === '') {
            cwd = loaderDir;
        }
    } else {
        var doc = document
        var scripts = doc.scripts

        // Recommend to add `MLBFnode` id for the `sea.js` script element
        var loaderScript = doc.getElementById("MLBFnode") ||
            scripts[scripts.length - 1]

        function getScriptAbsoluteSrc(node) {
            return node.hasAttribute ? // non-IE6/7
                node.src :
                // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
                node.getAttribute("src", 4)
        }
        loaderPath = getScriptAbsoluteSrc(loaderScript)
            // When `sea.js` is inline, set loaderDir to current working directory
        loaderDir = dirname(loaderPath || cwd)
    }

    /**
     * util-request.js - The utilities for requesting script and style files
     * ref: tests/research/load-js-css/test.html
     */
    if (isWebWorker) {
        function requestFromWebWorker(url, callback, charset) {
                // Load with importScripts
                var error;
                try {
                    importScripts(url);
                } catch (e) {
                    error = e;
                }
                callback(error);
            }
            // For Developers
        MLBF.request = requestFromWebWorker;
    } else {
        var doc = document
        var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement
        var baseElement = head.getElementsByTagName("base")[0]

        var currentlyAddingScript

        function request(url, callback, charset) {
            var isCSS = IS_CSS_RE.test(url)

            var node = doc.createElement(isCSS ? "link" : "script")

            if (charset) {
                var cs = isFunction(charset) ? charset(url) : charset
                if (cs) {
                    node.charset = cs
                }
            }

            addOnload(node, callback, isCSS, url)

            if (isCSS) {
                node.rel = "stylesheet"
                node.href = url
            } else {
                node.async = true
                node.src = url
            }

            // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
            // the end of the insert execution, so use `currentlyAddingScript` to
            // hold current node, for deriving url in `define` call
            currentlyAddingScript = node

            // ref: #185 & http://dev.jquery.com/ticket/2709
            baseElement ?
                head.insertBefore(node, baseElement) :
                head.appendChild(node)

            currentlyAddingScript = null
        }

        function addOnload(node, callback, isCSS, url) {
            var supportOnload = "onload" in node

            // for Old WebKit and Old Firefox
            if (isCSS && (isOldWebKit || !supportOnload)) {
                setTimeout(function() {
                        pollCss(node, callback)
                    }, 1) // Begin after node insertion
                return
            }

            if (supportOnload) {
                node.onload = onload
                node.onerror = function() {
                    emit("error", {
                        uri: url,
                        node: node
                    })
                    onload(true)
                }
            } else {
                node.onreadystatechange = function() {
                    if (/loaded|complete/.test(node.readyState)) {
                        onload()
                    }
                }
            }

            function onload(error) {
                // Ensure only run once and handle memory leak in IE
                node.onload = node.onerror = node.onreadystatechange = null

                // Remove the script to reduce memory leak
                if (!isCSS && !data.debug) {
                    head.removeChild(node)
                }

                // Dereference the node
                node = null

                callback(error)
            }
        }

        // For Developers
        MLBF.request = request

    }

    function pollCss(node, callback) {
        var sheet = node.sheet
        var isLoaded

        // for WebKit < 536
        if (isOldWebKit) {
            if (sheet) {
                isLoaded = true
            }
        }
        // for Firefox < 9.0
        else if (sheet) {
            try {
                if (sheet.cssRules) {
                    isLoaded = true
                }
            } catch (ex) {
                // The value of `ex.name` is changed from "NS_ERROR_DOM_SECURITY_ERR"
                // to "SecurityError" since Firefox 13.0. But Firefox is less than 9.0
                // in here, So it is ok to just rely on "NS_ERROR_DOM_SECURITY_ERR"
                if (ex.name === "NS_ERROR_DOM_SECURITY_ERR") {
                    isLoaded = true
                }
            }
        }

        setTimeout(function() {
            if (isLoaded) {
                // Place callback here to give time for style rendering
                callback()
            } else {
                pollCss(node, callback)
            }
        }, 20)
    }

    var interactiveScript

    function getCurrentScript() {
        if (currentlyAddingScript) {
            return currentlyAddingScript
        }

        // For IE6-9 browsers, the script onload event may not fire right
        // after the script is evaluated. Kris Zyp found that it
        // could query the script nodes and the one that is in "interactive"
        // mode indicates the current script
        // ref: http://goo.gl/JHfFW
        if (interactiveScript && interactiveScript.readyState === "interactive") {
            return interactiveScript
        }

        var scripts = head.getElementsByTagName("script")

        for (var i = scripts.length - 1; i >= 0; i--) {
            var script = scripts[i]
            if (script.readyState === "interactive") {
                interactiveScript = script
                return interactiveScript
            }
        }
    }

    /**
     * module.js - The core of module loader
     */

    var cachedMods = MLBF.cache = {}
    var anonymousMeta

    var fetchingList = {}
    var fetchedList = {}
    var callbackList = {}

    var STATUS = Module.STATUS = {
        // 1 - The `module.uri` is being fetched
        FETCHING: 1,
        // 2 - The meta data has been saved to cachedMods
        SAVED: 2,
        // 3 - The `module.dependencies` are being loaded
        LOADING: 3,
        // 4 - The module are ready to execute
        LOADED: 4,
        // 5 - The module is being executed
        EXECUTING: 5,
        // 6 - The `module.exports` is available
        EXECUTED: 6,
        // 7 - 404
        ERROR: 7
    }


    function Module(uri, deps) {
        this.uri = uri
        this.dependencies = deps || []
        this.deps = {} // Ref the dependence modules
        this.status = 0

        this._entry = []
    }

    // Resolve module.dependencies
    Module.prototype.resolve = function() {
        var mod = this
        var ids = mod.dependencies
        var uris = []

        for (var i = 0, len = ids.length; i < len; i++) {
            uris[i] = Module.resolve(ids[i], mod.uri)
        }
        return uris
    }

    Module.prototype.pass = function() {
        var mod = this

        var len = mod.dependencies.length

        for (var i = 0; i < mod._entry.length; i++) {
            var entry = mod._entry[i]
            var count = 0
            for (var j = 0; j < len; j++) {
                var m = mod.deps[mod.dependencies[j]]
                    // If the module is unload and unused in the entry, pass entry to it
                if (m.status < STATUS.LOADED && !entry.history.hasOwnProperty(m.uri)) {
                    entry.history[m.uri] = true
                    count++
                    m._entry.push(entry)
                    if (m.status === STATUS.LOADING) {
                        m.pass()
                    }
                }
            }
            // If has passed the entry to it's dependencies, modify the entry's count and del it in the module
            if (count > 0) {
                entry.remain += count - 1
                mod._entry.shift()
                i--
            }
        }
    }

    // Load module.dependencies and fire onload when all done
    Module.prototype.load = function() {
        var mod = this

        // If the module is being loaded, just wait it onload call
        if (mod.status >= STATUS.LOADING) {
            return
        }

        mod.status = STATUS.LOADING

        // Emit `load` event for plugins such as combo plugin
        var uris = mod.resolve()
        emit("load", uris)

        for (var i = 0, len = uris.length; i < len; i++) {
            mod.deps[mod.dependencies[i]] = Module.get(uris[i])
        }

        // Pass entry to it's dependencies
        mod.pass()

        // If module has entries not be passed, call onload
        if (mod._entry.length) {
            mod.onload()
            return
        }

        // Begin parallel loading
        var requestCache = {}
        var m

        for (i = 0; i < len; i++) {
            m = cachedMods[uris[i]]

            if (m.status < STATUS.FETCHING) {
                m.fetch(requestCache)
            } else if (m.status === STATUS.SAVED) {
                m.load()
            }
        }

        // Send all requests at last to avoid cache bug in IE6-9. Issues#808
        for (var requestUri in requestCache) {
            if (requestCache.hasOwnProperty(requestUri)) {
                requestCache[requestUri]()
            }
        }
    }

    // Call this method when module is loaded
    Module.prototype.onload = function() {
        var mod = this
        mod.status = STATUS.LOADED

        // When sometimes cached in IE, exec will occur before onload, make sure len is an number
        for (var i = 0, len = (mod._entry || []).length; i < len; i++) {
            var entry = mod._entry[i]
            if (--entry.remain === 0) {
                entry.callback()
            }
        }

        delete mod._entry
    }

    // Call this method when module is 404
    Module.prototype.error = function() {
        var mod = this
        mod.onload()
        mod.status = STATUS.ERROR
    }

    // Execute a module
    Module.prototype.exec = function() {
        var mod = this

        // When module is executed, DO NOT execute it again. When module
        // is being executed, just return `module.exports` too, for avoiding
        // circularly calling
        if (mod.status >= STATUS.EXECUTING) {
            return mod.exports
        }

        mod.status = STATUS.EXECUTING

        if (mod._entry && !mod._entry.length) {
            delete mod._entry
        }

        //non-cmd module has no property factory and exports
        if (!mod.hasOwnProperty('factory')) {
            mod.non = true
            return
        }

        // Create require
        var uri = mod.uri

        function require(id) {
            var m = mod.deps[id] || Module.get(require.resolve(id))
            if (m.status == STATUS.ERROR) {
                throw new Error('module was broken: ' + m.uri);
            }
            return m.exec()
        }

        require.resolve = function(id) {
            return Module.resolve(id, uri)
        }

        require.async = function(ids, callback) {
            Module.use(ids, callback, uri + "_async_" + cid())
            return require
        }

        // Exec factory
        var factory = mod.factory

        var exports = isFunction(factory) ?
            factory(require, mod.exports = {}, mod) :
            factory

        if (exports === undefined) {
            exports = mod.exports
        }

        // Reduce memory leak
        delete mod.factory

        mod.exports = exports
        mod.status = STATUS.EXECUTED

        // Emit `exec` event
        emit("exec", mod)

        return mod.exports
    }

    // Fetch a module
    Module.prototype.fetch = function(requestCache) {
        var mod = this
        var uri = mod.uri

        mod.status = STATUS.FETCHING

        // Emit `fetch` event for plugins such as combo plugin
        var emitData = {
            uri: uri
        }
        emit("fetch", emitData)
        var requestUri = emitData.requestUri || uri

        // Empty uri or a non-CMD module
        if (!requestUri || fetchedList.hasOwnProperty(requestUri)) {
            mod.load()
            return
        }

        if (fetchingList.hasOwnProperty(requestUri)) {
            callbackList[requestUri].push(mod)
            return
        }

        fetchingList[requestUri] = true
        callbackList[requestUri] = [mod]

        // Emit `request` event for plugins such as text plugin
        emit("request", emitData = {
            uri: uri,
            requestUri: requestUri,
            onRequest: onRequest,
            charset: isFunction(data.charset) ? data.charset(requestUri) || 'utf-8' : data.charset
        })

        if (!emitData.requested) {
            requestCache ?
                requestCache[emitData.requestUri] = sendRequest :
                sendRequest()
        }

        function sendRequest() {
            MLBF.request(emitData.requestUri, emitData.onRequest, emitData.charset)
        }

        function onRequest(error) {
            delete fetchingList[requestUri]
            fetchedList[requestUri] = true

            // Save meta data of anonymous module
            if (anonymousMeta) {
                Module.save(uri, anonymousMeta)
                anonymousMeta = null
            }

            // Call callbacks
            var m, mods = callbackList[requestUri]
            delete callbackList[requestUri]
            while ((m = mods.shift())) {
                // When 404 occurs, the params error will be true
                if (error === true) {
                    m.error()
                } else {
                    m.load()
                }
            }
        }
    }

    // Resolve id to uri
    Module.resolve = function(id, refUri) {
        // Emit `resolve` event for plugins such as text plugin
        var emitData = {
            id: id,
            refUri: refUri
        }
        emit("resolve", emitData)

        return emitData.uri || MLBF.resolve(emitData.id, refUri)
    }

    // Define a module
    Module.define = function(id, deps, factory) {
        var argsLen = arguments.length

        // define(factory)
        if (argsLen === 1) {
            factory = id
            id = undefined
        } else if (argsLen === 2) {
            factory = deps

            // define(deps, factory)
            if (isArray(id)) {
                deps = id
                id = undefined
            }
            // define(id, factory)
            else {
                deps = undefined
            }
        }

        var meta = {
            id: id,
            uri: Module.resolve(id),
            deps: deps,
            factory: factory
        }

        // Try to derive uri in IE6-9 for anonymous modules
        if (!isWebWorker && !meta.uri && doc.attachEvent && typeof getCurrentScript !== "undefined") {
            var script = getCurrentScript()

            if (script) {
                meta.uri = script.src
            }

            // NOTE: If the id-deriving methods above is failed, then falls back
            // to use onload event to get the uri
        }

        // Emit `define` event, used in nocache plugin, MLBF node version etc
        emit("define", meta)

        meta.uri ? Module.save(meta.uri, meta) :
            // Save information for "saving" work in the script onload event
            anonymousMeta = meta
    }

    // Save meta data to cachedMods
    Module.save = function(uri, meta) {
        var mod = Module.get(uri)

        // Do NOT override already saved modules
        if (mod.status < STATUS.SAVED) {
            mod.id = meta.id || uri
            mod.dependencies = meta.deps || []
            mod.factory = meta.factory
            mod.status = STATUS.SAVED

            emit("save", mod)
        }
    }

    // Get an existed module or create a new one
    Module.get = function(uri, deps) {
        return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps))
    }

    // Use function is equal to load a anonymous module
    Module.use = function(ids, callback, uri) {
        var mod = Module.get(uri, isArray(ids) ? ids : [ids])

        mod._entry.push(mod)
        mod.history = {}
        mod.remain = 1

        mod.callback = function() {
            var exports = []
            var uris = mod.resolve()

            for (var i = 0, len = uris.length; i < len; i++) {
                exports[i] = cachedMods[uris[i]].exec()
            }

            if (callback) {
                callback.apply(global, exports)
            }

            delete mod.callback
            delete mod.history
            delete mod.remain
            delete mod._entry
        }

        mod.load()
    }


    // Public API

    MLBF.use = function(ids, callback) {
        Module.use(ids, callback, data.cwd + "_use_" + cid())
        return MLBF
    }

    Module.define.cmd = {}
    //global.define = Module.define


    // For Developers

    MLBF.Module = Module
        // add by hongri
    MLBF.define = Module.define

    data.fetchedList = fetchedList
    data.cid = cid

    MLBF.require = function(id) {
        var mod = Module.get(Module.resolve(id))
        if (mod.status < STATUS.EXECUTING) {
            mod.onload()
            mod.exec()
        }
        return mod.exports
    }

    /**
     * config.js - The configuration for the loader
     */

    // The root path to use for id2uri parsing
    data.base = loaderDir

    // The loader directory
    data.dir = loaderDir

    // The loader's full path
    data.loader = loaderPath

    // The current working directory
    data.cwd = cwd

    // The charset for requesting files
    data.charset = "utf-8"

    // data.alias - An object containing shorthands of module id
    // data.paths - An object containing path shorthands in module id
    // data.vars - The {xxx} variables in module id
    // data.map - An array containing rules to map module uri
    // data.debug - Debug mode. The default value is false

    MLBF.config = function(configData) {

        for (var key in configData) {
            var curr = configData[key]
            var prev = data[key]

            // Merge object config such as alias, vars
            if (prev && isObject(prev)) {
                for (var k in curr) {
                    prev[k] = curr[k]
                }
            } else {
                // Concat array config such as map
                if (isArray(prev)) {
                    curr = prev.concat(curr)
                }
                // Make sure that `data.base` is an absolute path
                else if (key === "base") {
                    // Make sure end with "/"
                    if (curr.slice(-1) !== "/") {
                        curr += "/"
                    }
                    curr = addBase(curr)
                }

                // Set config
                data[key] = curr
            }
        }

        emit("config", configData)
        return MLBF
    }

})(this);
/******************************************************************************
 * MLBF Controller 0.0.1 2015-05-26
 * author hongri
 ******************************************************************************/

MLBF.define('app.Controller', function(require) {
    var extend = require('util.extend'),
        $ = require('lib.Zepto'),
        template = require('lib.template'),
        _ = require('util.underscore'),
        proxy = require('lang.proxy'),
        defaults = require('util.defaults'),
        Attribute = require('util.Attribute'),
        Class = require('util.Class');

    var methods = {},
        fn = Zepto.fn;

    //this.method = this.$el.method
    for (var methodName in fn) {
        if (fn.hasOwnProperty(methodName)) {
            (function(methodName) {
                methods[methodName] = function() {
                    if (!this.$el) {
                        this.setElement('<div></div>');
                    }
                    var result = this.$el[methodName].apply(this.$el, arguments);
                    return this.$el === result ? this : result;
                }
            })(methodName);
        }
    }

    delete methods.constructor;

    /**
     * All ui components' base. All Zepto methods and template engine are mixed in.
     * @class Node
     * @namespace app.Controller
     * @extends util.Class
     * @uses lib.Zepto
     * @uses util.Attributes
     * @constructor
     * @param {String|Zepto|documentElement|ui.Nodes.Node} selector Node selector
     * @example
     *      new Node('#someElement'); // Turn element, which id is 'someElement', into a node
     *
     * @example
     *      // Zepto object or Node object or document element object are all acceptable
     *      new Node($('#someElement'));
     *      new Node(new Node('#someElement'));
     *      new Node(document.getElementById('someElement'));
     */
    return Class.inherit(methods, Attribute, {
        initialize: function(opts) {

            //merge options
            this.mergeOptions(opts);

            //render structure
            this.render();

            /**
             * Fire when node initialized
             * @event load
             * @param {Event} event JQuery event
             * @param {Node} node Node object
             */
            this.trigger('load', [this]);
        },

        /**
         * @method $
         * @uses lib.Zepto
         */
        $: $,

        /**
         * @method Zepto
         * @uses lib.Zepto
         */
        Zepto: $,

        /**
         * @method template
         * @uses util.template
         */
        template: template,

        // todo
        // copy static property settings when inheriting

        /**
         * Merge options with defaults and cache to node.opts
         * @method mergeOptions
         * @param {Object} opts Options to be merged
         * @protected
         * @chainable
         * @example
         *      node.mergeOptions({
         *          //options
         *      });
         */
        mergeOptions: function(opts) {
            // use this.defaults before fall back to constructor.settings
            // which enables default settings to be inherited
            var options = defaults(true, opts || (opts = {}), this.defaults || this.constructor.settings || {});

            // set to attributes, keep silent to avoid firing change event
            this.set(options, {
                silence: true
            });
            return this;
        },

        /**
         * Render node
         * Most node needs overwritten this method for own logic
         * @method render
         * @chainable
         */
        render: function() {
            this.setElement(this.get('selector') || this.selector);
            return this;
        },

        /**
         * Set node's $el. $el is the base of a node ( UI component )
         * Cautious: direct change of node.$el may be dangerous
         * @method setElement
         * @param {String|documentElement|Zepto|Node} el The element to be core $el of the node
         * @chainable
         */
        setElement: function(el) {
            var $el = this.Zepto(el.node || el || this.selector) ;

            if (this.$el) {
                this.$el.replaceWith($el);
            }

            this.$el = $el;
            this.el = $el.get(0);

            // customize className
            if (this.get('className')) {
                this.$el.addClass(this.get('className'));
            }

            // Initialization of common elements for the component
            this.initElements();

            // Component default events
            this.delegateEvents();

            // Instance events
            this.initEvents();

            // Component's default actions, should be placed after initElements
            this.defaultActions();

            return this;
        },

        /**
         * Delegate events to node
         * @method delegateEvents
         * @param {Object} [events=this.events] Events to be delegated
         * @chainable
         * @example
         *      node.delegateEvents({
         *          'click .child': function(){
         *              alert('child clicked');
         *          }
         *      });
         */
        delegateEvents: function(events) {
            events = events || this.events;
            if (!events) {
                return this;
            }

            // delegate events
            var node = this;
            $.each(events, function(delegate, handler) {
                var args = (delegate + '').split(' '),
                    eventType = args.shift(),
                    selector = args.join(' ');

                if ($.trim(selector).length > 0) {
                    // has selector
                    // use delegate
                    node.delegate(selector, eventType, function() {
                        return node[handler].apply(node, arguments);
                    });

                    return;
                }

                node.bind(eventType, function() {
                    return node[handler].apply(node, arguments);
                });
            });

            return this;
        },

        /**
         * All default actions bound to node's $el
         * @method defaultActions
         * @protected
         */
        defaultActions: function() {

        },

        /**
         * Bind options.events
         * @method initEvents
         * @param {Object} [delegate=this] Object to be apply as this in callback
         * @chainable
         * @protected
         */
        initEvents: function(delegate) {
            var node = this,
                events = this.get('events');

            if (!events) {
                return this;
            }

            delegate = delegate || node;
            for (var eventName in events) {
                if (events.hasOwnProperty(eventName)) {
                    node.bind(eventName, proxy(events[eventName], delegate));
                }
            }

            return this;
        },

        /**
         * Find this.elements, wrap them with Zepto and cache to this, like this.$name
         * @method initElements
         * @chainable
         * @protected
         */
        initElements: function() {
            var elements = this.elements;

            if (elements) {
                for (var name in elements) {
                    if (elements.hasOwnProperty(name)) {
                        this[name] = this.find(elements[name]);
                    }
                }
            }

            return this;
        }
    });
});
/******************************************************************************
 * MLBF Controller 0.0.5 2015-06-10
 * author hongri
 ******************************************************************************/
MLBF.define('app.Model', function(require, exports, module) {
    var extend = require('util.extend'),
        Attribute = require('util.Attribute'),
        Class = require('util.Class');

   	/**
     * All ui components' base. All Zepto methods and template engine are mixed in.
     * @class Node
     * @namespace app.Controller
     * @extends util.Class
     * @uses lib.Zepto
     * @uses util.Attributes
     * @constructor
     * @param {String|Zepto|documentElement|ui.Nodes.Node} selector Node selector
     * @example
     *      new Node('#someElement'); // Turn element, which id is 'someElement', into a node
     *
     * @example
     *      // Zepto object or Node object or document element object are all acceptable
     *      new Node($('#someElement'));
     *      new Node(new Node('#someElement'));
     *      new Node(document.getElementById('someElement'));
     */
    return Class.inherit(Attribute, {
        initialize: function(opts) {
            /**
             * Fire when node initialized
             * @event load
             * @param {Event} event JQuery event
             * @param {Node} node Node object
             */
            this.trigger('load', [this]);
        }
    });

});
/******************************************************************************
 * MLBF 0.0.1 2015-06-02
 * author hongri
 ******************************************************************************/
MLBF.define('app.REST', function(require) {
    var extend = require('util.extend'),
        _ = require('util.underscore'),
        cookie = require('util.Cookie'),
        $ = require('lib.Zepto'),
        Model = require('app.Model'),
        Attribute = require('util.Attribute'),
        Event = require('util.Event');

    // var plugins = {
    //     errorLog: require('app.RESTPlugins.errorLog'),
    //     speedReport: require('app.RESTPlugins.speedReport'),
    //     CSRFPatch: require('app.RESTPlugins.CSRFPatch')
    // };

    var plugins = {};

    // Map from CRUD to HTTP for our default sync implementation.
    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'del': 'DELETE',
        'read': 'GET'
    };

    var defaults = {
        errorStatusCode: 608,
        ajax: {}
    };

    /**
     * Restful sync component, provides CRUD methods for ajax programing.
     * REST component supports middle ware plugin and has built-in middle wares of auto error log, auto speed report, auto CSRF patch
     * @class REST
     * @namespace app
     * @module app
     */
    var REST = extend({
        /**
         * An interface to $.ajax
         * @method ajax
         * @static
         * @see $.ajax
         */
        ajax: $.ajax,

        /**
         * Main method for REST to communicate with backend
         * @method sync
         * @static
         * @param {String} method Accept CRUD methods only
         * @param {Object} options Sync options
         * @param {Object} [options.data] Data to be sent
         * @returns {Zepto.xhr} Zepto xhr object, supports promise
         */
        sync: function(method, options) {
            var type = methodMap[method];

            // Default options, unless specified.
            var ajaxDefaults = this.attributes().ajax;

            var contentType = options.contentType || 'application/json';

            // Default JSON-request options.
            var params = {
                type: type,
                dataType: 'json'
            };

            var ajaxHeaders = {};

            // // 微信银行
            // if(cookie.get("wx_uid")) {
            //     ajaxHeaders = {
            //         uid: cookie.get("wx_uid") || '',
            //         token: cookie.get("wx_token") || ''
            //     };
            // }

            // // 社区银行
            // if(cookie.get("memberCode")) {
            //     ajaxHeaders = {
            //         memberCode: cookie.get("memberCode") || '',
            //         token: cookie.get("u_login_token") || ''
            //     };
            // }

            // Ensure that we have a URL.
            !options.url && urlError();

            params.headers = options.headers;

            // Ensure that we have the appropriate request data.
            if (contentType == 'application/json' &&
                typeof options.data === 'object' &&
                (type === 'POST' || type === 'PUT' || type === 'DELETE')) {
                params.contentType = 'application/json';
                params.data = options.data = JSON.stringify(options.data || {});
            } else {
                params.data = options.data || {};
            }

            // Wrap success & error handler
            wrapHandler(this, options);

            var ajaxSettings = extend(params, ajaxDefaults, options);

            /**
             * Event triggered when before sending a request
             * @event beforeSend
             * @param ajaxSettings The final settings(params) of sync
             */
            this.trigger('beforeSend', ajaxSettings);

            // Make the request, allowing the user to override any Ajax options.
            var xhr = options.xhr = this.ajax(ajaxSettings);

            // Replace xhr.fail to transformed arguments
            wrapXHR(xhr);

            /**
             * Event triggered when a request been made
             * @event request
             * @param xhr The XMLHttpRequest instance from $.ajax
             * @param ajaxSettings The final settings(params) of sync
             */
            this.trigger('request', xhr, ajaxSettings);

            return xhr;
        },

        /**
         * Use plugin ( middle ware )
         * 3 built-in plugins (errorLog/speedReport/CSRFPatch) provided right now.
         * @method use
         * @static
         * @param {String|Function} plugin Plugin name, or plugin function. A plugin is a middle ware that will be invoked before sync action (right before event beforeSend)
         * @chainable
         * @example
         *
         *      // Plugin errorLog use monitor.logger and share it's config
         *      logger.config({
         *          writelogger: true,
         *          proj: 'REST test'
         *      });
         *
         *      // Set plugin(middle ware) config
         *      REST.set({
         *          log: {
         *              module: 'test page',
         *              fn: 'test case'
         *          },
         *          CSRF: {
         *              token: '_bqq_csrf'
         *          }
         *      });
         *
         *      // Use plugins
         *      REST
         *          // auto error log plugin
         *          .use('errorLog')
         *
         *          // auto speed report plugin
         *          // speed report need additional option 'speedReport' when sync
         *          .use('speedReport')
         *
         *          // auto CSRF patch
         *          .use('CSRFPatch');
         *
         *
         *      REST.read({
         *          uri: 'readApi',
         *
         *          // Speed report plugin config
         *          // 3 flags & 1 point to identified the report point
         *          // Rate is the percentage to send speed report
         *          speed: {
         *              flag1: 1,
         *              flag2: 2,
         *              flag3: 3,
         *              point: 2,
         *              rate: 1
         *          }
         *      });
         */
        use: function(plugin) {
            _.isFunction(plugin) ?
                plugin(this) :
                plugins[plugin] && plugins[plugin](this);

            return this;
        }
    }, Attribute, Event);

    /**
     * Create operation on backend
     * @method create
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {Zepto.xhr} Zepto xhr object, supports promise
     */

    /**
     * Read data from backend
     * @method read
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {Zepto.xhr} Zepto xhr object, supports promise
     * @example
     *      LBF.use(['app.REST'], function(REST){
     *          // Read data from backend
     *          // Create/update/del are mostly the same
     *          var xhr = REST.read({
     *              url: 'readApi',
     *
     *              // Success callback
     *              success: function(res, options){
     *                  logger.log('read success');
     *              },
     *
     *              // Error callback
     *              error: function(err, xhr, jQErr){
     *                  logger.log('read error');
     *                  logger.log(err.message);
     *              }
     *          });
     *
     *          // Zepto xhr object, supports promise
     *          xhr
     *              .done(function(res, options){
     *                  logger.log('read done');
     *              })
     *              .fail(function(err, xhr, jQErr){
     *                  logger.log('read fail');
     *              })
     *              // Arguments to then callbacks depend on promise state
     *              .then(function(){
     *                  logger.log('read then');
     *              });
     *      });
     */

    /**
     * Update operation on backend
     * @method update
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {Zepto.xhr} Zepto xhr object, supports promise
     */

    /**
     * delete operation on backend
     * use method name 'del' because 'delete' is reserved in IE
     * @method del
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {Zepto.xhr} Zepto xhr object, supports promise
     */
    _.forEach(['create', 'read', 'update', 'del'], function(method) {
        REST[method] = function(options) {
            return this.sync(method, options);
        };
    });

    REST.on('error', function(err, xhr, textStatus, jQErr) {
        var status = err.status,
            code = err.code,
            errorStatusCode = this.get('errorStatusCode');

        /**
         * Event triggered at a particular http status, like 500/404/509 etc
         * When status is 500, the name of triggered event is 500, not 'status'
         * @event status
         * @param {Error} err Error instance
         * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
         * @param {String} textStatus Description text of the status
         * @param {$Error} jQErr Error instance created by $.ajax
         * @example
         *      // Watch http status 404
         *      REST.on(404, function(){
         *          logger.log(404);
         *      });
         */
        this.trigger(status, err, xhr, textStatus, jQErr);

        /**
         * Event triggered when status is the specified one (like 509) and an error code come up
         * @event errorCode
         * @param {Error} err Error instance
         * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
         * @param {String} textStatus Description text of the status
         * @param {$Error} jQErr Error instance created by $.ajax
         * @example
         *      // Watch code 1001
         *      REST.on('error1001', function(){
         *          logger.log(1001);
         *      });
         */
        status === errorStatusCode && this.trigger('error' + code, err, xhr, textStatus, jQErr);
    });

    // use default settings
    REST.set(defaults);

    return REST;

    /**
     * Wrap success and error handler
     * @method wrapHandler
     * @private
     * @static
     * @param REST
     * @param {Object} options Sync options
     */
    function wrapHandler(REST, options) {
        var successCallbck = options.success,
            errorCallback = options.error;

        options.success = function(res) {
            successCallbck && successCallbck.apply(this, arguments);

            /**
             * Event triggered when a sync succeeds
             * @event sync
             * @param {Object} res Response data
             * @param {Object} options Sync options
             */
            REST.trigger('sync', res, options);
        };

        options.error = function(xhr, textStatus, httpError) {
            var err = wrapError(xhr, httpError);

            /**
             * @param {Object} err Error object
             * @param {Number} err.code Error code, default to be -1 if not assign
             * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
             * @param {String} textStatus Text status of error
             * @param {String} httpError Http status error
             */
            errorCallback && errorCallback.call(this, err, xhr, textStatus, httpError);

            /**
             * Event triggered when a sync fails
             * @event error
             * @param {Object} err Error object
             * @param {Number} err.code Error code, default to be -1 if not assign
             * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
             * @param {String} textStatus Text status of error
             * @param {String} httpError Http status error
             */
            REST.trigger('error', err, xhr, textStatus, httpError);
        };
    }

    /**
     * Wrap fail method of jqXHR to provide more friendly callback arguments
     * @method wrapXHR
     * @private
     * @param {Object} options Sync options
     */
    function wrapXHR(xhr) {
        var fail = xhr.fail;

        xhr.fail = function(fn) {
            var wrappedFn = function(xhr, textStatus, httpError) {
                var err = wrapError(xhr, httpError);
                /**
                 * Call original fail method with transformed arguments
                 * @param {Object} err Error object
                 * @param {Number} err.code Error code, default to be -1 if not assign
                 * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
                 * @param {String} textStatus Text status of error
                 * @param {String} httpError Http status error
                 */
                fn.call(this, err, xhr, textStatus, httpError);
            };

            return fail.call(this, wrappedFn);
        };
    }

    /**
     * Wrap error from xhr response text, with fallback
     * @method wrapError
     * @private
     * @param {jqXHR} xhr
     * @param {String} httpError HTTP status error wording
     * @return {Error} Wrapped error object
     */
    function wrapError(xhr, httpError) {
        var err = new Error,
            res;

        try {
            // try decode error body as JSON
            res = JSON.parse(xhr.responseText);
        } catch (e) {
            // when error occurs at decoding
            // wrap error string, and create common error object
            res = {
                code: xhr.status,
                message: xhr.responseText || httpError
            }
        }

        err.code = res.code;
        err.message = res.message;
        // copy http status
        err.status = xhr.status;

        //backsend data
        res.data && (err.data = res.data);

        return err;
    }

    function urlError() {
        throw new Error('url must be specified');
    }
});
/******************************************************************************
 * MLBF 1.0.1 2015-05-27
 * author hongri
 ******************************************************************************/

MLBF.define('lib.Zepto', function(require) {

    /* Zepto v1.1.6 - zepto event ajax form ie - zeptojs.com/license */

    var Zepto = (function() {
        var undefined, key, $, classList, emptyArray = [],
            slice = emptyArray.slice,
            filter = emptyArray.filter,
            document = window.document,
            elementDisplay = {},
            classCache = {},
            cssNumber = {
                'column-count': 1,
                'columns': 1,
                'font-weight': 1,
                'line-height': 1,
                'opacity': 1,
                'z-index': 1,
                'zoom': 1
            },
            fragmentRE = /^\s*<(\w+|!)[^>]*>/,
            singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
            tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
            rootNodeRE = /^(?:body|html)$/i,
            capitalRE = /([A-Z])/g,

            // special attributes that should be get/set via method calls
            methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

            adjacencyOperators = ['after', 'prepend', 'before', 'append'],
            table = document.createElement('table'),
            tableRow = document.createElement('tr'),
            containers = {
                'tr': document.createElement('tbody'),
                'tbody': table,
                'thead': table,
                'tfoot': table,
                'td': tableRow,
                'th': tableRow,
                '*': document.createElement('div')
            },
            readyRE = /complete|loaded|interactive/,
            simpleSelectorRE = /^[\w-]*$/,
            class2type = {},
            toString = class2type.toString,
            zepto = {},
            camelize, uniq,
            tempParent = document.createElement('div'),
            propMap = {
                'tabindex': 'tabIndex',
                'readonly': 'readOnly',
                'for': 'htmlFor',
                'class': 'className',
                'maxlength': 'maxLength',
                'cellspacing': 'cellSpacing',
                'cellpadding': 'cellPadding',
                'rowspan': 'rowSpan',
                'colspan': 'colSpan',
                'usemap': 'useMap',
                'frameborder': 'frameBorder',
                'contenteditable': 'contentEditable'
            },
            isArray = Array.isArray ||
            function(object) {
                return object instanceof Array
            }

        zepto.matches = function(element, selector) {
            if (!selector || !element || element.nodeType !== 1) return false
            var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                element.oMatchesSelector || element.matchesSelector
            if (matchesSelector) return matchesSelector.call(element, selector)
                // fall back to performing a selector:
            var match, parent = element.parentNode,
                temp = !parent
            if (temp)(parent = tempParent).appendChild(element)
            match = ~zepto.qsa(parent, selector).indexOf(element)
            temp && tempParent.removeChild(element)
            return match
        }

        function type(obj) {
            return obj == null ? String(obj) :
                class2type[toString.call(obj)] || "object"
        }

        function isFunction(value) {
            return type(value) == "function"
        }

        function isWindow(obj) {
            return obj != null && obj == obj.window
        }

        function isDocument(obj) {
            return obj != null && obj.nodeType == obj.DOCUMENT_NODE
        }

        function isObject(obj) {
            return type(obj) == "object"
        }

        function isPlainObject(obj) {
            return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
        }

        function likeArray(obj) {
            return typeof obj.length == 'number'
        }

        function compact(array) {
            return filter.call(array, function(item) {
                return item != null
            })
        }

        function flatten(array) {
            return array.length > 0 ? $.fn.concat.apply([], array) : array
        }
        camelize = function(str) {
            return str.replace(/-+(.)?/g, function(match, chr) {
                return chr ? chr.toUpperCase() : ''
            })
        }

        function dasherize(str) {
            return str.replace(/::/g, '/')
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                .replace(/([a-z\d])([A-Z])/g, '$1_$2')
                .replace(/_/g, '-')
                .toLowerCase()
        }
        uniq = function(array) {
            return filter.call(array, function(item, idx) {
                return array.indexOf(item) == idx
            })
        }

        function classRE(name) {
            return name in classCache ?
                classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
        }

        function maybeAddPx(name, value) {
            return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
        }

        function defaultDisplay(nodeName) {
            var element, display
            if (!elementDisplay[nodeName]) {
                element = document.createElement(nodeName)
                document.body.appendChild(element)
                display = getComputedStyle(element, '').getPropertyValue("display")
                element.parentNode.removeChild(element)
                display == "none" && (display = "block")
                elementDisplay[nodeName] = display
            }
            return elementDisplay[nodeName]
        }

        function children(element) {
            return 'children' in element ?
                slice.call(element.children) :
                $.map(element.childNodes, function(node) {
                    if (node.nodeType == 1) return node
                })
        }

        // `$.zepto.fragment` takes a html string and an optional tag name
        // to generate DOM nodes nodes from the given html string.
        // The generated DOM nodes are returned as an array.
        // This function can be overriden in plugins for example to make
        // it compatible with browsers that don't support the DOM fully.
        zepto.fragment = function(html, name, properties) {
            var dom, nodes, container

            // A special case optimization for a single tag
            if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

            if (!dom) {
                if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
                if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
                if (!(name in containers)) name = '*'

                container = containers[name]
                container.innerHTML = '' + html
                dom = $.each(slice.call(container.childNodes), function() {
                    container.removeChild(this)
                })
            }

            if (isPlainObject(properties)) {
                nodes = $(dom)
                $.each(properties, function(key, value) {
                    if (methodAttributes.indexOf(key) > -1) nodes[key](value)
                    else nodes.attr(key, value)
                })
            }

            return dom
        }

        // `$.zepto.Z` swaps out the prototype of the given `dom` array
        // of nodes with `$.fn` and thus supplying all the Zepto functions
        // to the array. Note that `__proto__` is not supported on Internet
        // Explorer. This method can be overriden in plugins.
        zepto.Z = function(dom, selector) {
            dom = dom || []
            dom.__proto__ = $.fn
            dom.selector = selector || ''
            return dom
        }

        // `$.zepto.isZ` should return `true` if the given object is a Zepto
        // collection. This method can be overriden in plugins.
        zepto.isZ = function(object) {
            return object instanceof zepto.Z
        }

        // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
        // takes a CSS selector and an optional context (and handles various
        // special cases).
        // This method can be overriden in plugins.
        zepto.init = function(selector, context) {
            var dom
                // If nothing given, return an empty Zepto collection
            if (!selector) return zepto.Z()
                // Optimize for string selectors
            else if (typeof selector == 'string') {
                selector = selector.trim()
                    // If it's a html fragment, create nodes from it
                    // Note: In both Chrome 21 and Firefox 15, DOM error 12
                    // is thrown if the fragment doesn't begin with <
                if (selector[0] == '<' && fragmentRE.test(selector))
                    dom = zepto.fragment(selector, RegExp.$1, context), selector = null
                    // If there's a context, create a collection on that context first, and select
                    // nodes from there
                else if (context !== undefined) return $(context).find(selector)
                    // If it's a CSS selector, use it to select nodes.
                else dom = zepto.qsa(document, selector)
            }
            // If a function is given, call it when the DOM is ready
            else if (isFunction(selector)) return $(document).ready(selector)
                // If a Zepto collection is given, just return it
            else if (zepto.isZ(selector)) return selector
            else {
                // normalize array if an array of nodes is given
                if (isArray(selector)) dom = compact(selector)
                    // Wrap DOM nodes.
                else if (isObject(selector))
                    dom = [selector], selector = null
                    // If it's a html fragment, create nodes from it
                else if (fragmentRE.test(selector))
                    dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
                    // If there's a context, create a collection on that context first, and select
                    // nodes from there
                else if (context !== undefined) return $(context).find(selector)
                    // And last but no least, if it's a CSS selector, use it to select nodes.
                else dom = zepto.qsa(document, selector)
            }
            // create a new Zepto collection from the nodes found
            return zepto.Z(dom, selector)
        }

        // `$` will be the base `Zepto` object. When calling this
        // function just call `$.zepto.init, which makes the implementation
        // details of selecting nodes and creating Zepto collections
        // patchable in plugins.
        $ = function(selector, context) {
            return zepto.init(selector, context)
        }

        function extend(target, source, deep) {
            for (key in source)
                if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
                    if (isPlainObject(source[key]) && !isPlainObject(target[key]))
                        target[key] = {}
                    if (isArray(source[key]) && !isArray(target[key]))
                        target[key] = []
                    extend(target[key], source[key], deep)
                } else if (source[key] !== undefined) target[key] = source[key]
        }

        // Copy all but undefined properties from one or more
        // objects to the `target` object.
        $.extend = function(target) {
            var deep, args = slice.call(arguments, 1)
            if (typeof target == 'boolean') {
                deep = target
                target = args.shift()
            }
            args.forEach(function(arg) {
                extend(target, arg, deep)
            })
            return target
        }

        // `$.zepto.qsa` is Zepto's CSS selector implementation which
        // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
        // This method can be overriden in plugins.
        zepto.qsa = function(element, selector) {
            var found,
                maybeID = selector[0] == '#',
                maybeClass = !maybeID && selector[0] == '.',
                nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
                isSimple = simpleSelectorRE.test(nameOnly)
            return (isDocument(element) && isSimple && maybeID) ?
                ((found = element.getElementById(nameOnly)) ? [found] : []) :
                (element.nodeType !== 1 && element.nodeType !== 9) ? [] :
                slice.call(
                    isSimple && !maybeID ?
                    maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
                    element.getElementsByTagName(selector) : // Or a tag
                    element.querySelectorAll(selector) // Or it's not simple, and we need to query all
                )
        }

        function filtered(nodes, selector) {
            return selector == null ? $(nodes) : $(nodes).filter(selector)
        }

        $.contains = document.documentElement.contains ?
            function(parent, node) {
                return parent !== node && parent.contains(node)
            } :
            function(parent, node) {
                while (node && (node = node.parentNode))
                    if (node === parent) return true
                return false
            }

        function funcArg(context, arg, idx, payload) {
            return isFunction(arg) ? arg.call(context, idx, payload) : arg
        }

        function setAttribute(node, name, value) {
            value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
        }

        // access className property while respecting SVGAnimatedString
        function className(node, value) {
            var klass = node.className || '',
                svg = klass && klass.baseVal !== undefined

            if (value === undefined) return svg ? klass.baseVal : klass
            svg ? (klass.baseVal = value) : (node.className = value)
        }

        // "true"  => true
        // "false" => false
        // "null"  => null
        // "42"    => 42
        // "42.5"  => 42.5
        // "08"    => "08"
        // JSON    => parse if valid
        // String  => self
        function deserializeValue(value) {
            try {
                return value ?
                    value == "true" ||
                    (value == "false" ? false :
                        value == "null" ? null :
                        +value + "" == value ? +value :
                        /^[\[\{]/.test(value) ? $.parseJSON(value) :
                        value) : value
            } catch (e) {
                return value
            }
        }

        $.type = type
        $.isFunction = isFunction
        $.isWindow = isWindow
        $.isArray = isArray
        $.isPlainObject = isPlainObject

        $.isEmptyObject = function(obj) {
            var name
            for (name in obj) return false
            return true
        }

        $.inArray = function(elem, array, i) {
            return emptyArray.indexOf.call(array, elem, i)
        }

        $.camelCase = camelize
        $.trim = function(str) {
            return str == null ? "" : String.prototype.trim.call(str)
        }

        // plugin compatibility
        $.uuid = 0
        $.support = {}
        $.expr = {}

        $.map = function(elements, callback) {
            var value, values = [],
                i, key
            if (likeArray(elements))
                for (i = 0; i < elements.length; i++) {
                    value = callback(elements[i], i)
                    if (value != null) values.push(value)
                } else
                    for (key in elements) {
                        value = callback(elements[key], key)
                        if (value != null) values.push(value)
                    }
            return flatten(values)
        }

        $.each = function(elements, callback) {
            var i, key
            if (likeArray(elements)) {
                for (i = 0; i < elements.length; i++)
                    if (callback.call(elements[i], i, elements[i]) === false) return elements
            } else {
                for (key in elements)
                    if (callback.call(elements[key], key, elements[key]) === false) return elements
            }

            return elements
        }

        $.grep = function(elements, callback) {
            return filter.call(elements, callback)
        }

        if (window.JSON) $.parseJSON = JSON.parse

        // Populate the class2type map
        $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
            class2type["[object " + name + "]"] = name.toLowerCase()
        })

        // Define methods that will be available on all
        // Zepto collections
        $.fn = {
            // Because a collection acts like an array
            // copy over these useful array functions.
            forEach: emptyArray.forEach,
            reduce: emptyArray.reduce,
            push: emptyArray.push,
            sort: emptyArray.sort,
            indexOf: emptyArray.indexOf,
            concat: emptyArray.concat,

            // `map` and `slice` in the jQuery API work differently
            // from their array counterparts
            map: function(fn) {
                return $($.map(this, function(el, i) {
                    return fn.call(el, i, el)
                }))
            },
            slice: function() {
                return $(slice.apply(this, arguments))
            },

            ready: function(callback) {
                // need to check if document.body exists for IE as that browser reports
                // document ready when it hasn't yet created the body element
                if (readyRE.test(document.readyState) && document.body) callback($)
                else document.addEventListener('DOMContentLoaded', function() {
                    callback($)
                }, false)
                return this
            },
            get: function(idx) {
                return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
            },
            toArray: function() {
                return this.get()
            },
            size: function() {
                return this.length
            },
            remove: function() {
                return this.each(function() {
                    if (this.parentNode != null)
                        this.parentNode.removeChild(this)
                })
            },
            each: function(callback) {
                emptyArray.every.call(this, function(el, idx) {
                    return callback.call(el, idx, el) !== false
                })
                return this
            },
            filter: function(selector) {
                if (isFunction(selector)) return this.not(this.not(selector))
                return $(filter.call(this, function(element) {
                    return zepto.matches(element, selector)
                }))
            },
            add: function(selector, context) {
                return $(uniq(this.concat($(selector, context))))
            },
            is: function(selector) {
                return this.length > 0 && zepto.matches(this[0], selector)
            },
            not: function(selector) {
                var nodes = []
                if (isFunction(selector) && selector.call !== undefined)
                    this.each(function(idx) {
                        if (!selector.call(this, idx)) nodes.push(this)
                    })
                else {
                    var excludes = typeof selector == 'string' ? this.filter(selector) :
                        (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
                    this.forEach(function(el) {
                        if (excludes.indexOf(el) < 0) nodes.push(el)
                    })
                }
                return $(nodes)
            },
            has: function(selector) {
                return this.filter(function() {
                    return isObject(selector) ?
                        $.contains(this, selector) :
                        $(this).find(selector).size()
                })
            },
            eq: function(idx) {
                return idx === -1 ? this.slice(idx) : this.slice(idx, +idx + 1)
            },
            first: function() {
                var el = this[0]
                return el && !isObject(el) ? el : $(el)
            },
            last: function() {
                var el = this[this.length - 1]
                return el && !isObject(el) ? el : $(el)
            },
            find: function(selector) {
                var result, $this = this
                if (!selector) result = $()
                else if (typeof selector == 'object')
                    result = $(selector).filter(function() {
                        var node = this
                        return emptyArray.some.call($this, function(parent) {
                            return $.contains(parent, node)
                        })
                    })
                else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
                else result = this.map(function() {
                    return zepto.qsa(this, selector)
                })
                return result
            },
            closest: function(selector, context) {
                var node = this[0],
                    collection = false
                if (typeof selector == 'object') collection = $(selector)
                while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
                    node = node !== context && !isDocument(node) && node.parentNode
                return $(node)
            },
            parents: function(selector) {
                var ancestors = [],
                    nodes = this
                while (nodes.length > 0)
                    nodes = $.map(nodes, function(node) {
                        if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
                            ancestors.push(node)
                            return node
                        }
                    })
                return filtered(ancestors, selector)
            },
            parent: function(selector) {
                return filtered(uniq(this.pluck('parentNode')), selector)
            },
            children: function(selector) {
                return filtered(this.map(function() {
                    return children(this)
                }), selector)
            },
            contents: function() {
                return this.map(function() {
                    return slice.call(this.childNodes)
                })
            },
            siblings: function(selector) {
                return filtered(this.map(function(i, el) {
                    return filter.call(children(el.parentNode), function(child) {
                        return child !== el
                    })
                }), selector)
            },
            empty: function() {
                return this.each(function() {
                    this.innerHTML = ''
                })
            },
            // `pluck` is borrowed from Prototype.js
            pluck: function(property) {
                return $.map(this, function(el) {
                    return el[property]
                })
            },
            show: function() {
                return this.each(function() {
                    this.style.display == "none" && (this.style.display = '')
                    if (getComputedStyle(this, '').getPropertyValue("display") == "none")
                        this.style.display = defaultDisplay(this.nodeName)
                })
            },
            replaceWith: function(newContent) {
                return this.before(newContent).remove()
            },
            wrap: function(structure) {
                var func = isFunction(structure)
                if (this[0] && !func)
                    var dom = $(structure).get(0),
                        clone = dom.parentNode || this.length > 1

                return this.each(function(index) {
                    $(this).wrapAll(
                        func ? structure.call(this, index) :
                        clone ? dom.cloneNode(true) : dom
                    )
                })
            },
            wrapAll: function(structure) {
                if (this[0]) {
                    $(this[0]).before(structure = $(structure))
                    var children
                        // drill down to the inmost element
                    while ((children = structure.children()).length) structure = children.first()
                    $(structure).append(this)
                }
                return this
            },
            wrapInner: function(structure) {
                var func = isFunction(structure)
                return this.each(function(index) {
                    var self = $(this),
                        contents = self.contents(),
                        dom = func ? structure.call(this, index) : structure
                    contents.length ? contents.wrapAll(dom) : self.append(dom)
                })
            },
            unwrap: function() {
                this.parent().each(function() {
                    $(this).replaceWith($(this).children())
                })
                return this
            },
            clone: function() {
                return this.map(function() {
                    return this.cloneNode(true)
                })
            },
            hide: function() {
                return this.css("display", "none")
            },
            toggle: function(setting) {
                return this.each(function() {
                    var el = $(this);
                    (setting === undefined ? el.css("display") == "none" : setting) ? el.show(): el.hide()
                })
            },
            prev: function(selector) {
                return $(this.pluck('previousElementSibling')).filter(selector || '*')
            },
            next: function(selector) {
                return $(this.pluck('nextElementSibling')).filter(selector || '*')
            },
            html: function(html) {
                return 0 in arguments ?
                    this.each(function(idx) {
                        var originHtml = this.innerHTML
                        $(this).empty().append(funcArg(this, html, idx, originHtml))
                    }) :
                    (0 in this ? this[0].innerHTML : null)
            },
            text: function(text) {
                return 0 in arguments ?
                    this.each(function(idx) {
                        var newText = funcArg(this, text, idx, this.textContent)
                        this.textContent = newText == null ? '' : '' + newText
                    }) :
                    (0 in this ? this[0].textContent : null)
            },
            attr: function(name, value) {
                var result
                return (typeof name == 'string' && !(1 in arguments)) ?
                    (!this.length || this[0].nodeType !== 1 ? undefined :
                        (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
                    ) :
                    this.each(function(idx) {
                        if (this.nodeType !== 1) return
                        if (isObject(name))
                            for (key in name) setAttribute(this, key, name[key])
                        else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
                    })
            },
            removeAttr: function(name) {
                return this.each(function() {
                    this.nodeType === 1 && name.split(' ').forEach(function(attribute) {
                        setAttribute(this, attribute)
                    }, this)
                })
            },
            prop: function(name, value) {
                name = propMap[name] || name
                return (1 in arguments) ?
                    this.each(function(idx) {
                        this[name] = funcArg(this, value, idx, this[name])
                    }) :
                    (this[0] && this[0][name])
            },
            data: function(name, value) {
                var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

                var data = (1 in arguments) ?
                    this.attr(attrName, value) :
                    this.attr(attrName)

                return data !== null ? deserializeValue(data) : undefined
            },
            val: function(value) {
                return 0 in arguments ?
                    this.each(function(idx) {
                        this.value = funcArg(this, value, idx, this.value)
                    }) :
                    (this[0] && (this[0].multiple ?
                        $(this[0]).find('option').filter(function() {
                            return this.selected
                        }).pluck('value') :
                        this[0].value))
            },
            offset: function(coordinates) {
                if (coordinates) return this.each(function(index) {
                    var $this = $(this),
                        coords = funcArg(this, coordinates, index, $this.offset()),
                        parentOffset = $this.offsetParent().offset(),
                        props = {
                            top: coords.top - parentOffset.top,
                            left: coords.left - parentOffset.left
                        }

                    if ($this.css('position') == 'static') props['position'] = 'relative'
                    $this.css(props)
                })
                if (!this.length) return null
                var obj = this[0].getBoundingClientRect()
                return {
                    left: obj.left + window.pageXOffset,
                    top: obj.top + window.pageYOffset,
                    width: Math.round(obj.width),
                    height: Math.round(obj.height)
                }
            },
            css: function(property, value) {
                if (arguments.length < 2) {
                    var computedStyle, element = this[0]
                    if (!element) return
                    computedStyle = getComputedStyle(element, '')
                    if (typeof property == 'string')
                        return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
                    else if (isArray(property)) {
                        var props = {}
                        $.each(property, function(_, prop) {
                            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
                        })
                        return props
                    }
                }

                var css = ''
                if (type(property) == 'string') {
                    if (!value && value !== 0)
                        this.each(function() {
                            this.style.removeProperty(dasherize(property))
                        })
                    else
                        css = dasherize(property) + ":" + maybeAddPx(property, value)
                } else {
                    for (key in property)
                        if (!property[key] && property[key] !== 0)
                            this.each(function() {
                                this.style.removeProperty(dasherize(key))
                            })
                        else
                            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
                }

                return this.each(function() {
                    this.style.cssText += ';' + css
                })
            },
            index: function(element) {
                return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
            },
            hasClass: function(name) {
                if (!name) return false
                return emptyArray.some.call(this, function(el) {
                    return this.test(className(el))
                }, classRE(name))
            },
            addClass: function(name) {
                if (!name) return this
                return this.each(function(idx) {
                    if (!('className' in this)) return
                    classList = []
                    var cls = className(this),
                        newName = funcArg(this, name, idx, cls)
                    newName.split(/\s+/g).forEach(function(klass) {
                        if (!$(this).hasClass(klass)) classList.push(klass)
                    }, this)
                    classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
                })
            },
            removeClass: function(name) {
                return this.each(function(idx) {
                    if (!('className' in this)) return
                    if (name === undefined) return className(this, '')
                    classList = className(this)
                    funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass) {
                        classList = classList.replace(classRE(klass), " ")
                    })
                    className(this, classList.trim())
                })
            },
            toggleClass: function(name, when) {
                if (!name) return this
                return this.each(function(idx) {
                    var $this = $(this),
                        names = funcArg(this, name, idx, className(this))
                    names.split(/\s+/g).forEach(function(klass) {
                        (when === undefined ? !$this.hasClass(klass) : when) ?
                        $this.addClass(klass): $this.removeClass(klass)
                    })
                })
            },
            scrollTop: function(value) {
                if (!this.length) return
                var hasScrollTop = 'scrollTop' in this[0]
                if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
                return this.each(hasScrollTop ?
                    function() {
                        this.scrollTop = value
                    } :
                    function() {
                        this.scrollTo(this.scrollX, value)
                    })
            },
            scrollLeft: function(value) {
                if (!this.length) return
                var hasScrollLeft = 'scrollLeft' in this[0]
                if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
                return this.each(hasScrollLeft ?
                    function() {
                        this.scrollLeft = value
                    } :
                    function() {
                        this.scrollTo(value, this.scrollY)
                    })
            },
            position: function() {
                if (!this.length) return

                var elem = this[0],
                    // Get *real* offsetParent
                    offsetParent = this.offsetParent(),
                    // Get correct offsets
                    offset = this.offset(),
                    parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? {
                        top: 0,
                        left: 0
                    } : offsetParent.offset()

                // Subtract element margins
                // note: when an element has margin: auto the offsetLeft and marginLeft
                // are the same in Safari causing offset.left to incorrectly be 0
                offset.top -= parseFloat($(elem).css('margin-top')) || 0
                offset.left -= parseFloat($(elem).css('margin-left')) || 0

                // Add offsetParent borders
                parentOffset.top += parseFloat($(offsetParent[0]).css('border-top-width')) || 0
                parentOffset.left += parseFloat($(offsetParent[0]).css('border-left-width')) || 0

                // Subtract the two offsets
                return {
                    top: offset.top - parentOffset.top,
                    left: offset.left - parentOffset.left
                }
            },
            offsetParent: function() {
                return this.map(function() {
                    var parent = this.offsetParent || document.body
                    while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
                        parent = parent.offsetParent
                    return parent
                })
            }
        }

        // for now
        $.fn.detach = $.fn.remove

        // Generate the `width` and `height` functions
        ;
        ['width', 'height'].forEach(function(dimension) {
            var dimensionProperty =
                dimension.replace(/./, function(m) {
                    return m[0].toUpperCase()
                })

            $.fn[dimension] = function(value) {
                var offset, el = this[0]
                if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
                    isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
                    (offset = this.offset()) && offset[dimension]
                else return this.each(function(idx) {
                    el = $(this)
                    el.css(dimension, funcArg(this, value, idx, el[dimension]()))
                })
            }
        })

        function traverseNode(node, fun) {
            fun(node)
            for (var i = 0, len = node.childNodes.length; i < len; i++)
                traverseNode(node.childNodes[i], fun)
        }

        // Generate the `after`, `prepend`, `before`, `append`,
        // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
        adjacencyOperators.forEach(function(operator, operatorIndex) {
            var inside = operatorIndex % 2 //=> prepend, append

            $.fn[operator] = function() {
                // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
                var argType, nodes = $.map(arguments, function(arg) {
                        argType = type(arg)
                        return argType == "object" || argType == "array" || arg == null ?
                            arg : zepto.fragment(arg)
                    }),
                    parent, copyByClone = this.length > 1
                if (nodes.length < 1) return this

                return this.each(function(_, target) {
                    parent = inside ? target : target.parentNode

                    // convert all methods to a "before" operation
                    target = operatorIndex == 0 ? target.nextSibling :
                        operatorIndex == 1 ? target.firstChild :
                        operatorIndex == 2 ? target :
                        null

                    var parentInDocument = $.contains(document.documentElement, parent)

                    nodes.forEach(function(node) {
                        if (copyByClone) node = node.cloneNode(true)
                        else if (!parent) return $(node).remove()

                        parent.insertBefore(node, target)
                        if (parentInDocument) traverseNode(node, function(el) {
                            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
                                (!el.type || el.type === 'text/javascript') && !el.src)
                                window['eval'].call(window, el.innerHTML)
                        })
                    })
                })
            }

            // after    => insertAfter
            // prepend  => prependTo
            // before   => insertBefore
            // append   => appendTo
            $.fn[inside ? operator + 'To' : 'insert' + (operatorIndex ? 'Before' : 'After')] = function(html) {
                $(html)[operator](this)
                return this
            }
        })

        zepto.Z.prototype = $.fn

        // Export internal API functions in the `$.zepto` namespace
        zepto.uniq = uniq
        zepto.deserializeValue = deserializeValue
        $.zepto = zepto

        return $
    })()

    window.Zepto = Zepto
    window.$ === undefined && (window.$ = Zepto)

    ;
    (function($) {
        var _zid = 1,
            undefined,
            slice = Array.prototype.slice,
            isFunction = $.isFunction,
            isString = function(obj) {
                return typeof obj == 'string'
            },
            handlers = {},
            specialEvents = {},
            focusinSupported = 'onfocusin' in window,
            focus = {
                focus: 'focusin',
                blur: 'focusout'
            },
            hover = {
                mouseenter: 'mouseover',
                mouseleave: 'mouseout'
            }

        specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

        function zid(element) {
            return element._zid || (element._zid = _zid++)
        }

        function findHandlers(element, event, fn, selector) {
            event = parse(event)
            if (event.ns) var matcher = matcherFor(event.ns)
            return (handlers[zid(element)] || []).filter(function(handler) {
                return handler && (!event.e || handler.e == event.e) && (!event.ns || matcher.test(handler.ns)) && (!fn || zid(handler.fn) === zid(fn)) && (!selector || handler.sel == selector)
            })
        }

        function parse(event) {
            var parts = ('' + event).split('.')
            return {
                e: parts[0],
                ns: parts.slice(1).sort().join(' ')
            }
        }

        function matcherFor(ns) {
            return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
        }

        function eventCapture(handler, captureSetting) {
            return handler.del &&
                (!focusinSupported && (handler.e in focus)) ||
                !!captureSetting
        }

        function realEvent(type) {
            return hover[type] || (focusinSupported && focus[type]) || type
        }

        function add(element, events, fn, data, selector, delegator, capture) {
            var id = zid(element),
                set = (handlers[id] || (handlers[id] = []))
            events.split(/\s/).forEach(function(event) {
                if (event == 'ready') return $(document).ready(fn)
                var handler = parse(event)
                handler.fn = fn
                handler.sel = selector
                    // emulate mouseenter, mouseleave
                if (handler.e in hover) fn = function(e) {
                    var related = e.relatedTarget
                    if (!related || (related !== this && !$.contains(this, related)))
                        return handler.fn.apply(this, arguments)
                }
                handler.del = delegator
                var callback = delegator || fn
                handler.proxy = function(e) {
                    e = compatible(e)
                    if (e.isImmediatePropagationStopped()) return
                    e.data = data
                    var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
                    if (result === false) e.preventDefault(), e.stopPropagation()
                    return result
                }
                handler.i = set.length
                set.push(handler)
                if ('addEventListener' in element)
                    element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
            })
        }

        function remove(element, events, fn, selector, capture) {
            var id = zid(element);
            (events || '').split(/\s/).forEach(function(event) {
                findHandlers(element, event, fn, selector).forEach(function(handler) {
                    delete handlers[id][handler.i]
                    if ('removeEventListener' in element)
                        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
                })
            })
        }

        $.event = {
            add: add,
            remove: remove
        }

        $.proxy = function(fn, context) {
            var args = (2 in arguments) && slice.call(arguments, 2)
            if (isFunction(fn)) {
                var proxyFn = function() {
                    return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments)
                }
                proxyFn._zid = zid(fn)
                return proxyFn
            } else if (isString(context)) {
                if (args) {
                    args.unshift(fn[context], fn)
                    return $.proxy.apply(null, args)
                } else {
                    return $.proxy(fn[context], fn)
                }
            } else {
                throw new TypeError("expected function")
            }
        }

        $.fn.bind = function(event, data, callback) {
            return this.on(event, data, callback)
        }
        $.fn.unbind = function(event, callback) {
            return this.off(event, callback)
        }
        $.fn.one = function(event, selector, data, callback) {
            return this.on(event, selector, data, callback, 1)
        }

        var returnTrue = function() {
                return true
            },
            returnFalse = function() {
                return false
            },
            ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
            eventMethods = {
                preventDefault: 'isDefaultPrevented',
                stopImmediatePropagation: 'isImmediatePropagationStopped',
                stopPropagation: 'isPropagationStopped'
            }

        function compatible(event, source) {
            if (source || !event.isDefaultPrevented) {
                source || (source = event)

                $.each(eventMethods, function(name, predicate) {
                    var sourceMethod = source[name]
                    event[name] = function() {
                        this[predicate] = returnTrue
                        return sourceMethod && sourceMethod.apply(source, arguments)
                    }
                    event[predicate] = returnFalse
                })

                if (source.defaultPrevented !== undefined ? source.defaultPrevented :
                    'returnValue' in source ? source.returnValue === false :
                    source.getPreventDefault && source.getPreventDefault())
                    event.isDefaultPrevented = returnTrue
            }
            return event
        }

        function createProxy(event) {
            var key, proxy = {
                originalEvent: event
            }
            for (key in event)
                if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

            return compatible(proxy, event)
        }

        $.fn.delegate = function(selector, event, callback) {
            return this.on(event, selector, callback)
        }
        $.fn.undelegate = function(selector, event, callback) {
            return this.off(event, selector, callback)
        }

        $.fn.live = function(event, callback) {
            $(document.body).delegate(this.selector, event, callback)
            return this
        }
        $.fn.die = function(event, callback) {
            $(document.body).undelegate(this.selector, event, callback)
            return this
        }

        $.fn.on = function(event, selector, data, callback, one) {
            var autoRemove, delegator, $this = this
            if (event && !isString(event)) {
                $.each(event, function(type, fn) {
                    $this.on(type, selector, data, fn, one)
                })
                return $this
            }

            if (!isString(selector) && !isFunction(callback) && callback !== false)
                callback = data, data = selector, selector = undefined
            if (isFunction(data) || data === false)
                callback = data, data = undefined

            if (callback === false) callback = returnFalse

            return $this.each(function(_, element) {
                if (one) autoRemove = function(e) {
                    remove(element, e.type, callback)
                    return callback.apply(this, arguments)
                }

                if (selector) delegator = function(e) {
                    var evt, match = $(e.target).closest(selector, element).get(0)
                    if (match && match !== element) {
                        evt = $.extend(createProxy(e), {
                            currentTarget: match,
                            liveFired: element
                        })
                        return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
                    }
                }

                add(element, event, callback, data, selector, delegator || autoRemove)
            })
        }
        $.fn.off = function(event, selector, callback) {
            var $this = this
            if (event && !isString(event)) {
                $.each(event, function(type, fn) {
                    $this.off(type, selector, fn)
                })
                return $this
            }

            if (!isString(selector) && !isFunction(callback) && callback !== false)
                callback = selector, selector = undefined

            if (callback === false) callback = returnFalse

            return $this.each(function() {
                remove(this, event, callback, selector)
            })
        }

        $.fn.trigger = function(event, args) {
            event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
            event._args = args
            return this.each(function() {
                // handle focus(), blur() by calling them directly
                if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
                    // items in the collection might not be DOM elements
                else if ('dispatchEvent' in this) this.dispatchEvent(event)
                else $(this).triggerHandler(event, args)
            })
        }

        // triggers event handlers on current element just as if an event occurred,
        // doesn't trigger an actual event, doesn't bubble
        $.fn.triggerHandler = function(event, args) {
            var e, result
            this.each(function(i, element) {
                e = createProxy(isString(event) ? $.Event(event) : event)
                e._args = args
                e.target = element
                $.each(findHandlers(element, event.type || event), function(i, handler) {
                    result = handler.proxy(e)
                    if (e.isImmediatePropagationStopped()) return false
                })
            })
            return result
        }

        // shortcut methods for `.bind(event, fn)` for each event type
        ;
        ('focusin focusout focus blur load resize scroll unload click dblclick ' +
            'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave ' +
            'change select keydown keypress keyup error').split(' ').forEach(function(event) {
            $.fn[event] = function(callback) {
                return (0 in arguments) ?
                    this.bind(event, callback) :
                    this.trigger(event)
            }
        })

        $.Event = function(type, props) {
            if (!isString(type)) props = type, type = props.type
            var event = document.createEvent(specialEvents[type] || 'Events'),
                bubbles = true
            if (props)
                for (var name in props)(name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
            event.initEvent(type, bubbles, true)
            return compatible(event)
        }

    })(Zepto)

    ;
    (function($) {
        var jsonpID = 0,
            document = window.document,
            key,
            name,
            rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            scriptTypeRE = /^(?:text|application)\/javascript/i,
            xmlTypeRE = /^(?:text|application)\/xml/i,
            jsonType = 'application/json',
            htmlType = 'text/html',
            blankRE = /^\s*$/,
            originAnchor = document.createElement('a')

        originAnchor.href = window.location.href

        // trigger a custom event and return false if it was cancelled
        function triggerAndReturn(context, eventName, data) {
            var event = $.Event(eventName)
            $(context).trigger(event, data)
            return !event.isDefaultPrevented()
        }

        // trigger an Ajax "global" event
        function triggerGlobal(settings, context, eventName, data) {
            if (settings.global) return triggerAndReturn(context || document, eventName, data)
        }

        // Number of active Ajax requests
        $.active = 0

        function ajaxStart(settings) {
            if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
        }

        function ajaxStop(settings) {
            if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
        }

        // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
        function ajaxBeforeSend(xhr, settings) {
            var context = settings.context
            if (settings.beforeSend.call(context, xhr, settings) === false ||
                triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
                return false

            triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
        }

        function ajaxSuccess(data, xhr, settings, deferred) {
                var context = settings.context,
                    status = 'success'
                settings.success.call(context, data, status, xhr)
                if (deferred) deferred.resolveWith(context, [data, status, xhr])
                triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
                ajaxComplete(status, xhr, settings)
            }
            // type: "timeout", "error", "abort", "parsererror"
        function ajaxError(error, type, xhr, settings, deferred) {
                var context = settings.context
                settings.error.call(context, xhr, type, error)
                if (deferred) deferred.rejectWith(context, [xhr, type, error])
                triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
                ajaxComplete(type, xhr, settings)
            }
            // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
        function ajaxComplete(status, xhr, settings) {
            var context = settings.context
            settings.complete.call(context, xhr, status)
            triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
            ajaxStop(settings)
        }

        // Empty function, used as default callback
        function empty() {}

        $.ajaxJSONP = function(options, deferred) {
            if (!('type' in options)) return $.ajax(options)

            var _callbackName = options.jsonpCallback,
                callbackName = ($.isFunction(_callbackName) ?
                    _callbackName() : _callbackName) || ('jsonp' + (++jsonpID)),
                script = document.createElement('script'),
                originalCallback = window[callbackName],
                responseData,
                abort = function(errorType) {
                    $(script).triggerHandler('error', errorType || 'abort')
                },
                xhr = {
                    abort: abort
                },
                abortTimeout

            if (deferred) deferred.promise(xhr)

            $(script).on('load error', function(e, errorType) {
                clearTimeout(abortTimeout)
                $(script).off().remove()

                if (e.type == 'error' || !responseData) {
                    ajaxError(null, errorType || 'error', xhr, options, deferred)
                } else {
                    ajaxSuccess(responseData[0], xhr, options, deferred)
                }

                window[callbackName] = originalCallback
                if (responseData && $.isFunction(originalCallback))
                    originalCallback(responseData[0])

                originalCallback = responseData = undefined
            })

            if (ajaxBeforeSend(xhr, options) === false) {
                abort('abort')
                return xhr
            }

            window[callbackName] = function() {
                responseData = arguments
            }

            script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
            document.head.appendChild(script)

            if (options.timeout > 0) abortTimeout = setTimeout(function() {
                abort('timeout')
            }, options.timeout)

            return xhr
        }

        $.ajaxSettings = {
            // Default type of request
            type: 'GET',
            // Callback that is executed before request
            beforeSend: empty,
            // Callback that is executed if the request succeeds
            success: empty,
            // Callback that is executed the the server drops error
            error: empty,
            // Callback that is executed on request complete (both: error and success)
            complete: empty,
            // The context for the callbacks
            context: null,
            // Whether to trigger "global" Ajax events
            global: true,
            // Transport
            xhr: function() {
                return new window.XMLHttpRequest()
            },
            // MIME types mapping
            // IIS returns Javascript as "application/x-javascript"
            accepts: {
                script: 'text/javascript, application/javascript, application/x-javascript',
                json: jsonType,
                xml: 'application/xml, text/xml',
                html: htmlType,
                text: 'text/plain'
            },
            // Whether the request is to another domain
            crossDomain: false,
            // Default timeout
            timeout: 0,
            // Whether data should be serialized to string
            processData: true,
            // Whether the browser should be allowed to cache GET responses
            cache: true
        }

        function mimeToDataType(mime) {
            if (mime) mime = mime.split(';', 2)[0]
            return mime && (mime == htmlType ? 'html' :
                mime == jsonType ? 'json' :
                scriptTypeRE.test(mime) ? 'script' :
                xmlTypeRE.test(mime) && 'xml') || 'text'
        }

        function appendQuery(url, query) {
            if (query == '') return url
            return (url + '&' + query).replace(/[&?]{1,2}/, '?')
        }

        // serialize payload and append it to the URL for GET requests
        function serializeData(options) {
            if (options.processData && options.data && $.type(options.data) != "string")
                options.data = $.param(options.data, options.traditional)
            if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
                options.url = appendQuery(options.url, options.data), options.data = undefined
        }

        $.ajax = function(options) {
            var settings = $.extend({}, options || {}),
                deferred = $.Deferred && $.Deferred(),
                urlAnchor
            for (key in $.ajaxSettings)
                if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

            ajaxStart(settings)

            if (!settings.crossDomain) {
                urlAnchor = document.createElement('a')
                urlAnchor.href = settings.url
                urlAnchor.href = urlAnchor.href
                settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
            }

            if (!settings.url) settings.url = window.location.toString()
            serializeData(settings)

            var dataType = settings.dataType,
                hasPlaceholder = /\?.+=\?/.test(settings.url)
            if (hasPlaceholder) dataType = 'jsonp'

            if (settings.cache === false || (
                    (!options || options.cache !== true) &&
                    ('script' == dataType || 'jsonp' == dataType)
                ))
                settings.url = appendQuery(settings.url, '_=' + Date.now())

            if ('jsonp' == dataType) {
                if (!hasPlaceholder)
                    settings.url = appendQuery(settings.url,
                        settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
                return $.ajaxJSONP(settings, deferred)
            }

            var mime = settings.accepts[dataType],
                headers = {},
                setHeader = function(name, value) {
                    headers[name.toLowerCase()] = [name, value]
                },
                protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
                xhr = settings.xhr(),
                nativeSetHeader = xhr.setRequestHeader,
                abortTimeout

            if (deferred) deferred.promise(xhr)

            if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
            setHeader('Accept', mime || '*/*')
            if (mime = settings.mimeType || mime) {
                if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
                xhr.overrideMimeType && xhr.overrideMimeType(mime)
            }
            if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
                setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

            if (settings.headers)
                for (name in settings.headers) setHeader(name, settings.headers[name])
            xhr.setRequestHeader = setHeader

            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    xhr.onreadystatechange = empty
                    clearTimeout(abortTimeout)
                    var result, error = false
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
                        dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))
                        result = xhr.responseText

                        try {
                            // http://perfectionkills.com/global-eval-what-are-the-options/
                            if (dataType == 'script')(1, eval)(result)
                            else if (dataType == 'xml') result = xhr.responseXML
                            else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
                        } catch (e) {
                            error = e
                        }

                        if (error) ajaxError(error, 'parsererror', xhr, settings, deferred)
                        else ajaxSuccess(result, xhr, settings, deferred)
                    } else {
                        ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
                    }
                }
            }

            if (ajaxBeforeSend(xhr, settings) === false) {
                xhr.abort()
                ajaxError(null, 'abort', xhr, settings, deferred)
                return xhr
            }

            if (settings.xhrFields)
                for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

            var async = 'async' in settings ? settings.async : true
            xhr.open(settings.type, settings.url, async, settings.username, settings.password)

            for (name in headers) nativeSetHeader.apply(xhr, headers[name])

            if (settings.timeout > 0) abortTimeout = setTimeout(function() {
                xhr.onreadystatechange = empty
                xhr.abort()
                ajaxError(null, 'timeout', xhr, settings, deferred)
            }, settings.timeout)

            // avoid sending empty string (#319)
            xhr.send(settings.data ? settings.data : null)
            return xhr
        }

        // handle optional data/success arguments
        function parseArguments(url, data, success, dataType) {
            if ($.isFunction(data)) dataType = success, success = data, data = undefined
            if (!$.isFunction(success)) dataType = success, success = undefined
            return {
                url: url,
                data: data,
                success: success,
                dataType: dataType
            }
        }

        $.get = function( /* url, data, success, dataType */ ) {
            return $.ajax(parseArguments.apply(null, arguments))
        }

        $.post = function( /* url, data, success, dataType */ ) {
            var options = parseArguments.apply(null, arguments)
            options.type = 'POST'
            return $.ajax(options)
        }

        $.getJSON = function( /* url, data, success */ ) {
            var options = parseArguments.apply(null, arguments)
            options.dataType = 'json'
            return $.ajax(options)
        }

        $.fn.load = function(url, data, success) {
            if (!this.length) return this
            var self = this,
                parts = url.split(/\s/),
                selector,
                options = parseArguments(url, data, success),
                callback = options.success
            if (parts.length > 1) options.url = parts[0], selector = parts[1]
            options.success = function(response) {
                self.html(selector ?
                    $('<div>').html(response.replace(rscript, "")).find(selector) : response)
                callback && callback.apply(self, arguments)
            }
            $.ajax(options)
            return this
        }

        var escape = encodeURIComponent

        function serialize(params, obj, traditional, scope) {
            var type, array = $.isArray(obj),
                hash = $.isPlainObject(obj)
            $.each(obj, function(key, value) {
                type = $.type(value)
                if (scope) key = traditional ? scope :
                    scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
                    // handle data in serializeArray() format
                if (!scope && array) params.add(value.name, value.value)
                    // recurse into nested objects
                else if (type == "array" || (!traditional && type == "object"))
                    serialize(params, value, traditional, key)
                else params.add(key, value)
            })
        }

        $.param = function(obj, traditional) {
            var params = []
            params.add = function(key, value) {
                if ($.isFunction(value)) value = value()
                if (value == null) value = ""
                this.push(escape(key) + '=' + escape(value))
            }
            serialize(params, obj, traditional)
            return params.join('&').replace(/%20/g, '+')
        }
    })(Zepto)

    ;
    (function($) {
        $.fn.serializeArray = function() {
            var name, type, result = [],
                add = function(value) {
                    if (value.forEach) return value.forEach(add)
                    result.push({
                        name: name,
                        value: value
                    })
                }
            if (this[0]) $.each(this[0].elements, function(_, field) {
                type = field.type, name = field.name
                if (name && field.nodeName.toLowerCase() != 'fieldset' &&
                    !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
                    ((type != 'radio' && type != 'checkbox') || field.checked))
                    add($(field).val())
            })
            return result
        }

        $.fn.serialize = function() {
            var result = []
            this.serializeArray().forEach(function(elm) {
                result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
            })
            return result.join('&')
        }

        $.fn.submit = function(callback) {
            if (0 in arguments) this.bind('submit', callback)
            else if (this.length) {
                var event = $.Event('submit')
                this.eq(0).trigger(event)
                if (!event.isDefaultPrevented()) this.get(0).submit()
            }
            return this
        }

    })(Zepto)

    ;
    (function($) {
        // __proto__ doesn't exist on IE<11, so redefine
        // the Z function to use object extension instead
        if (!('__proto__' in {})) {
            $.extend($.zepto, {
                Z: function(dom, selector) {
                    dom = dom || []
                    $.extend(dom, $.fn)
                    dom.selector = selector || ''
                    dom.__Z = true
                    return dom
                },
                // this is a kludge but works
                isZ: function(object) {
                    return $.type(object) === 'array' && '__Z' in object
                }
            })
        }

        // getComputedStyle shouldn't freak out when called
        // without a valid element as argument
        try {
            getComputedStyle(undefined)
        } catch (e) {
            var nativeGetComputedStyle = getComputedStyle;
            window.getComputedStyle = function(element) {
                try {
                    return nativeGetComputedStyle(element)
                } catch (e) {
                    return null
                }
            }
        }
    })(Zepto);

    ;
    (function($) {
        var touch = {},
            touchTimeout, tapTimeout, swipeTimeout, longTapTimeout,
            longTapDelay = 750,
            /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu  start **/
            disableTouch,
            disableTouchTime,
            /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu  end **/
            gesture

        function swipeDirection(x1, x2, y1, y2) {
            return Math.abs(x1 - x2) >=
                Math.abs(y1 - y2) ? (x1 - x2 > 0 ? 'Left' : 'Right') : (y1 - y2 > 0 ? 'Up' : 'Down')
        }

        function longTap() {
            longTapTimeout = null
            if (touch.last) {
                touch.el.trigger('longTap')
                touch = {}
            }
        }

        function cancelLongTap() {
            if (longTapTimeout) clearTimeout(longTapTimeout)
            longTapTimeout = null
        }

        function cancelAll() {
            /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu  start **/
            clearTimeout(disableTouchTime);
            disableTouch = true;
            disableTouchTime = setTimeout(function(){
                disableTouch = false
            }, 350);
            /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu   end  **/
            if (touchTimeout) clearTimeout(touchTimeout)
            if (tapTimeout) clearTimeout(tapTimeout)
            if (swipeTimeout) clearTimeout(swipeTimeout)
            if (longTapTimeout) clearTimeout(longTapTimeout)
            touchTimeout = tapTimeout = swipeTimeout = longTapTimeout = null
            touch = {}
        }

        function isPrimaryTouch(event) {
            return (event.pointerType == 'touch' ||
                event.pointerType == event.MSPOINTER_TYPE_TOUCH) && event.isPrimary
        }

        function isPointerEventType(e, type) {
            return (e.type == 'pointer' + type ||
                e.type.toLowerCase() == 'mspointer' + type)
        }

        $(document).ready(function() {
            var now, delta, deltaX = 0,
                deltaY = 0,
                firstTouch, _isPointerType

            if ('MSGesture' in window) {
                gesture = new MSGesture()
                gesture.target = document.body
            }

            $(document)
                .bind('MSGestureEnd', function(e) {
                    var swipeDirectionFromVelocity =
                        e.velocityX > 1 ? 'Right' : e.velocityX < -1 ? 'Left' : e.velocityY > 1 ? 'Down' : e.velocityY < -1 ? 'Up' : null;
                    if (swipeDirectionFromVelocity) {
                        touch.el.trigger('swipe')
                        touch.el.trigger('swipe' + swipeDirectionFromVelocity)
                    }
                })
                .on('touchstart MSPointerDown pointerdown', function(e) {
                    /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu  start **/
                    if (disableTouch) return;
                    /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu  end **/
                    if ((_isPointerType = isPointerEventType(e, 'down')) &&
                        !isPrimaryTouch(e)) return
                    firstTouch = _isPointerType ? e : e.touches[0]
                    if (e.touches && e.touches.length === 1 && touch.x2) {
                        // Clear out touch movement data if we have it sticking around
                        // This can occur if touchcancel doesn't fire due to preventDefault, etc.
                        touch.x2 = undefined
                        touch.y2 = undefined
                    }
                    now = Date.now()
                    delta = now - (touch.last || now)
                    touch.el = $('tagName' in firstTouch.target ?
                        firstTouch.target : firstTouch.target.parentNode)
                    touchTimeout && clearTimeout(touchTimeout)
                    touch.x1 = firstTouch.pageX
                    touch.y1 = firstTouch.pageY
                    if (delta > 0 && delta <= 250) touch.isDoubleTap = true
                    touch.last = now
                    longTapTimeout = setTimeout(longTap, longTapDelay)
                        // adds the current touch contact for IE gesture recognition
                    if (gesture && _isPointerType) gesture.addPointer(e.pointerId);
                })
                .on('touchmove MSPointerMove pointermove', function(e) {
                    if ((_isPointerType = isPointerEventType(e, 'move')) &&
                        !isPrimaryTouch(e)) return
                    firstTouch = _isPointerType ? e : e.touches[0]
                    cancelLongTap()
                    touch.x2 = firstTouch.pageX
                    touch.y2 = firstTouch.pageY
                    deltaX += Math.abs(touch.x1 - touch.x2)
                    deltaY += Math.abs(touch.y1 - touch.y2)
                })
                .on('touchend MSPointerUp', function(e) {
                    if ((_isPointerType = isPointerEventType(e, 'up')) &&
                        !isPrimaryTouch(e)) return
                    cancelLongTap()
                    /**  解决首页轮播滑动直接跳转bug 新增 window.outTouchMove 条件 - tangyu  start **/
                    if(window.outTouchMove) {return setTimeout(function(){window.outTouchMove = false}, 10);}
                    /**  解决首页轮播滑动直接跳转bug 新增 window.outTouchMove 条件 - tangyu  end **/

                    if(window.move) {return;}
                    // swipe
                    if ((touch.x2 && Math.abs(touch.x1 - touch.x2) > 30) ||
                        (touch.y2 && Math.abs(touch.y1 - touch.y2) > 30))

                        swipeTimeout = setTimeout(function() {
                        touch.el.trigger('swipe')
                        touch.el.trigger('swipe' + (swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)))
                        touch = {}
                    }, 0)

                    // normal tap
                    else if ('last' in touch)
                    // don't fire tap when delta position changed by more than 30 pixels,
                    // for instance when moving to a point and back to origin
                        if (deltaX < 30 && deltaY < 30) {
                            // delay by one tick so we can cancel the "tap" event if 'scroll' fires
                            // ("tap" fires before 'scroll')
                            tapTimeout = setTimeout(function() {

                                // trigger universal "tap" with the option to cancelTouch()
                                // (cancelTouch cancels processing of single vs double taps for faster "tap" response)
                                var event = $.Event("tap");
                                //解决键盘挡住输入框报错信息看不到的问题 － 洪日
                                if (touch && touch.el && touch.el.length > 0 && touch.el[0].tagName !== "INPUT") {
                                    $("input").trigger("blur");
                                }
                                event.cancelTouch = cancelAll
                                touch.el.trigger(event)

                                // trigger double tap immediately
                                if (touch.isDoubleTap) {
                                    if (touch.el) touch.el.trigger('doubleTap')
                                    touch = {}
                                }

                                // trigger single tap after 250ms of inactivity
                                else {
                                    touchTimeout = setTimeout(function() {
                                        touchTimeout = null
                                        if (touch.el) touch.el.trigger('singleTap')
                                        touch = {}
                                    }, 250)
                                }
                            }, 0)
                        } else {
                            touch = {}
                        }
                    deltaX = deltaY = 0

                })
                // when the browser window loses focus,
                // for example when a modal dialog is shown,
                // cancel all ongoing events
                .on('touchcancel MSPointerCancel pointercancel', cancelAll)

            // scrolling the window indicates intention of the user
            // to scroll, not tap or swipe, so cancel all ongoing events
            $(window).on('scroll', cancelAll)
            /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu  start **/
            $('.page-content').on('scroll', cancelAll);
            /**  解决滑动时候强制停止滑动会跳转链接的问题 - tangyu  end **/
        })

        ;
        ['swipe', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown',
            'doubleTap', "tap", 'singleTap', 'longTap'
        ].forEach(function(eventName) {
            $.fn[eventName] = function(callback) {
                return this.on(eventName, callback)
            }
        })
    })(Zepto);

    //     Zepto.js
    //     (c) 2010-2015 Thomas Fuchs
    //     Zepto.js may be freely distributed under the MIT license.
    //
    //     Some code (c) 2005, 2013 jQuery Foundation, Inc. and other contributors

    ;
    (function($) {
        var slice = Array.prototype.slice

        function Deferred(func) {
            var tuples = [
                    // action, add listener, listener list, final state
                    ["resolve", "done", $.Callbacks({
                        once: 1,
                        memory: 1
                    }), "resolved"],
                    ["reject", "fail", $.Callbacks({
                        once: 1,
                        memory: 1
                    }), "rejected"],
                    ["notify", "progress", $.Callbacks({
                        memory: 1
                    })]
                ],
                state = "pending",
                promise = {
                    state: function() {
                        return state
                    },
                    always: function() {
                        deferred.done(arguments).fail(arguments)
                        return this
                    },
                    then: function( /* fnDone [, fnFailed [, fnProgress]] */ ) {
                        var fns = arguments
                        return Deferred(function(defer) {
                            $.each(tuples, function(i, tuple) {
                                var fn = $.isFunction(fns[i]) && fns[i]
                                deferred[tuple[1]](function() {
                                    var returned = fn && fn.apply(this, arguments)
                                    if (returned && $.isFunction(returned.promise)) {
                                        returned.promise()
                                            .done(defer.resolve)
                                            .fail(defer.reject)
                                            .progress(defer.notify)
                                    } else {
                                        var context = this === promise ? defer.promise() : this,
                                            values = fn ? [returned] : arguments
                                        defer[tuple[0] + "With"](context, values)
                                    }
                                })
                            })
                            fns = null
                        }).promise()
                    },

                    promise: function(obj) {
                        return obj != null ? $.extend(obj, promise) : promise
                    }
                },
                deferred = {}

            $.each(tuples, function(i, tuple) {
                var list = tuple[2],
                    stateString = tuple[3]

                promise[tuple[1]] = list.add

                if (stateString) {
                    list.add(function() {
                        state = stateString
                    }, tuples[i ^ 1][2].disable, tuples[2][2].lock)
                }

                deferred[tuple[0]] = function() {
                    deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
                    return this
                }
                deferred[tuple[0] + "With"] = list.fireWith
            })

            promise.promise(deferred)
            if (func) func.call(deferred, deferred)
            return deferred
        }

        $.when = function(sub) {
            var resolveValues = slice.call(arguments),
                len = resolveValues.length,
                i = 0,
                remain = len !== 1 || (sub && $.isFunction(sub.promise)) ? len : 0,
                deferred = remain === 1 ? sub : Deferred(),
                progressValues, progressContexts, resolveContexts,
                updateFn = function(i, ctx, val) {
                    return function(value) {
                        ctx[i] = this
                        val[i] = arguments.length > 1 ? slice.call(arguments) : value
                        if (val === progressValues) {
                            deferred.notifyWith(ctx, val)
                        } else if (!(--remain)) {
                            deferred.resolveWith(ctx, val)
                        }
                    }
                }

            if (len > 1) {
                progressValues = new Array(len)
                progressContexts = new Array(len)
                resolveContexts = new Array(len)
                for (; i < len; ++i) {
                    if (resolveValues[i] && $.isFunction(resolveValues[i].promise)) {
                        resolveValues[i].promise()
                            .done(updateFn(i, resolveContexts, resolveValues))
                            .fail(deferred.reject)
                            .progress(updateFn(i, progressContexts, progressValues))
                    } else {
                        --remain
                    }
                }
            }
            if (!remain) deferred.resolveWith(resolveContexts, resolveValues)
            return deferred.promise()
        }

        $.Deferred = Deferred
    })(Zepto)

    //     Zepto.js
    //     (c) 2010-2015 Thomas Fuchs
    //     Zepto.js may be freely distributed under the MIT license.

    ;
    (function($) {
        // Create a collection of callbacks to be fired in a sequence, with configurable behaviour
        // Option flags:
        //   - once: Callbacks fired at most one time.
        //   - memory: Remember the most recent context and arguments
        //   - stopOnFalse: Cease iterating over callback list
        //   - unique: Permit adding at most one instance of the same callback
        $.Callbacks = function(options) {
            options = $.extend({}, options)

            var memory, // Last fire value (for non-forgettable lists)
                fired, // Flag to know if list was already fired
                firing, // Flag to know if list is currently firing
                firingStart, // First callback to fire (used internally by add and fireWith)
                firingLength, // End of the loop when firing
                firingIndex, // Index of currently firing callback (modified by remove if needed)
                list = [], // Actual callback list
                stack = !options.once && [], // Stack of fire calls for repeatable lists
                fire = function(data) {
                    memory = options.memory && data
                    fired = true
                    firingIndex = firingStart || 0
                    firingStart = 0
                    firingLength = list.length
                    firing = true
                    for (; list && firingIndex < firingLength; ++firingIndex) {
                        if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
                            memory = false
                            break
                        }
                    }
                    firing = false
                    if (list) {
                        if (stack) stack.length && fire(stack.shift())
                        else if (memory) list.length = 0
                        else Callbacks.disable()
                    }
                },

                Callbacks = {
                    add: function() {
                        if (list) {
                            var start = list.length,
                                add = function(args) {
                                    $.each(args, function(_, arg) {
                                        if (typeof arg === "function") {
                                            if (!options.unique || !Callbacks.has(arg)) list.push(arg)
                                        } else if (arg && arg.length && typeof arg !== 'string') add(arg)
                                    })
                                }
                            add(arguments)
                            if (firing) firingLength = list.length
                            else if (memory) {
                                firingStart = start
                                fire(memory)
                            }
                        }
                        return this
                    },
                    remove: function() {
                        if (list) {
                            $.each(arguments, function(_, arg) {
                                var index
                                while ((index = $.inArray(arg, list, index)) > -1) {
                                    list.splice(index, 1)
                                        // Handle firing indexes
                                    if (firing) {
                                        if (index <= firingLength) --firingLength
                                        if (index <= firingIndex) --firingIndex
                                    }
                                }
                            })
                        }
                        return this
                    },
                    has: function(fn) {
                        return !!(list && (fn ? $.inArray(fn, list) > -1 : list.length))
                    },
                    empty: function() {
                        firingLength = list.length = 0
                        return this
                    },
                    disable: function() {
                        list = stack = memory = undefined
                        return this
                    },
                    disabled: function() {
                        return !list
                    },
                    lock: function() {
                        stack = undefined;
                        if (!memory) Callbacks.disable()
                        return this
                    },
                    locked: function() {
                        return !stack
                    },
                    fireWith: function(context, args) {
                        if (list && (!fired || stack)) {
                            args = args || []
                            args = [context, args.slice ? args.slice() : args]
                            if (firing) stack.push(args)
                            else fire(args)
                        }
                        return this
                    },
                    fire: function() {
                        return Callbacks.fireWith(this, arguments)
                    },
                    fired: function() {
                        return !!fired
                    }
                }

            return Callbacks
        }
    })(Zepto)

    return Zepto;
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('lang.proxy', function(require, exports, module){
    /**
     * Proxy function with assigned context.
     * By proxy function's context, inner function will get the assigned context instead of the invoking one
     * @class proxy
     * @namespace lang
     * @constructor
     * @param {Function} fn
     * @param {Object} context
     * @returns {Function}
     * @example
     *      var a = {
     *          x: 1,
     *          fn: function(){
     *              alert(this.x);
     *          }
     *      };
     *
     *      // this point to a
     *      a.fn(); // alert 1
     *
     *      var b = { x: 2};
     *      a.fn = proxy(a.fn, b);
     *
     *      // this point to b
     *      a.fn(); // alert 2
     */
    module.exports = function(fn, context){
        return function(){
            return fn.apply(context, arguments);
        };
    };
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Attribute', function(require, exports, module){
    var extend = require('util.extend');

    var ATTR = '_ATTRIBUTES',
        VALIDATES = '_VALIDATES';

    /**
     * [mixable] Common attributes handler. Can be extended to any object that wants event handler.
     * @class Attribute
     * @namespace util
     * @example
     *      // mix in instance example
     *      // assume classInstance is instance of lang.Class or its sub class
     *
     *      // use class's mix method
     *      classInstance.mix(Event);
     *
     *      // watch events
     *      classInstance.bind('someEvent', function(){
     *          // do sth
     *      });
     *
     * @example
     *      // extend a sub class example
     *
     *      // use class's extend method
     *      var SubClass = Class.extend(Event, {
     *          // some other methods
     *          method1: function(){
     *          },
     *
     *          method2: function(){
     *          }
     *      });
     *
     *      // initialize an instance
     *      classInstance = new SubClass;
     *
     *      // watch events
     *      classInstance.bind('someEvent', function(){
     *          // do sth
     *      });
     */


    /**
     * Set an attribute
     * @method set
     * @param {String} attr Attribute name
     * @param {*} value
     * @param {Object} options Other options for setter
     * @param {Boolean} [options.silence=false] Silently set attribute without fire change event
     * @chainable
     */
    exports.set = function(attr, val, options){
        var attrs = this[ATTR];

        if(!attrs){
            attrs = this[ATTR] = {};
        }

        if(typeof attr !== 'object'){
            var oAttr = attrs[attr];
            attrs[attr] = val;

            // validate
            if(!this.validate(attrs)){
                // restore value
                attrs[attr] = oAttr;
            } else {
                // trigger event only when value is changed and is not a silent setting
                if(val !== oAttr && (!options || !options.silence) && this.trigger){
                    /**
                     * Fire when an attribute changed
                     * Fire once for each change and trigger method is needed
                     * @event change:attr
                     * @param {Event} JQuery event
                     * @param {Object} Current attributes
                     */
                    this.trigger('change:' + attr, [attrs[attr], oAttr]);

                    /**
                     * Fire when attribute changed
                     * Fire once for each change and trigger method is needed
                     * @event change
                     * @param {Event} JQuery event
                     * @param {Object} Current attributes
                     */
                    this.trigger('change', [attrs]);
                }
            }

            return this;
        }

        // set multiple attributes by passing in an object
        // the 2nd arg is options in this case
        options = val;

        // plain merge
        // so settings will only be merged plainly
        var obj = extend({}, attrs, attr);

        if(this.validate(obj)){
            this[ATTR] = obj;
            // change event
            if((!options || !options.silence) && this.trigger){
                var changedCount = 0;
                for(var i in attr){
                    // has property and property changed
                    if(attr.hasOwnProperty(i) && obj[i] !== attrs[i]){
                        changedCount++;
                        this.trigger('change:' + i, [obj[i], attrs[i]]);
                    }
                }

                // only any attribute is changed can trigger change event
                changedCount > 0 && this.trigger('change', [obj]);
            }
        }

        return this;
    };

    /**
     * Get attribute
     * @method get
     * @param {String} attr Attribute name
     * @return {*}
     */
    exports.get = function(attr){
        return !this[ATTR] ? null : this[ATTR][attr];
    };

    /**
     * Get all attributes.
     * Be sure it's ready-only cause it's not a copy!
     * @method attributes
     * @returns {Object} All attributes
     */
    exports.attributes = function(){
        return this[ATTR] || {};
    };

    /**
     * Add validate for attributes
     * @method addValidate
     * @param {Function} validate Validate function, return false when failed validation
     * @chainable
     * @example
     *      instance.addValidate(function(event, attrs){
     *          if(attrs.someAttr !== 1){
     *              return false; // return false when failed validation
     *          }
     *      });
     */
    exports.addValidate = function(validate){
        var validates = this[VALIDATES];

        if(!validates){
            validates = this[VALIDATES] = [];
        }

        // validates for all attributes
        validates.push(validate);

        return this;
    };

    /**
     * Remove a validate function
     * @method removeValidate
     * @param {Function} validate Validate function
     * @chainable
     * @example
     *      instance.removeValidate(someExistValidate);
     */
    exports.removeValidate = function(validate){
        // remove all validates
        if(!validate){
            this[VALIDATES] = null;
            return this;
        }

        var valArr = this[VALIDATES];

        for(var i= 0, len= valArr.length; i< len; i++){
            if(valArr[i] === validate){
                valArr.splice(i, 1);
                --i;
                --len;
            }
        }

        return this;
    };

    /**
     * Validate all attributes
     * @method validate
     * @return {Boolean} Validation result, return false when failed validation
     */
    exports.validate = function(attrs){
        var valArr = this[VALIDATES];
        if(!valArr){
            return true;
        }

        attrs = attrs || this[ATTR];
        for(var i= 0, len= valArr.length; i< len; i++){
            if(valArr[i].call(this, attrs) === false){
                return false;
            }
        }

        return true;
    };
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Callbacks', function(require, exports, module) {
    var extend = require('util.extend'),
        _ = require('util.underscore');

    var REG_NOT_WHITE = /\S+/g;

    // String to Object options format cache
    var optionsCache = {};

    // Convert String-formatted options into Object-formatted ones and store in cache
    var createOptions = function(options) {
        var object = optionsCache[options] = {};
        _.forEach(options.match(REG_NOT_WHITE) || [], function(flag) {
            object[flag] = true;
        });
        return object;
    };

    /**
     * Create a callback list (written in actory mode)
     * By default a callback list will act like an event callback list and can be
     * 'fired' multiple times.
     * Borrowed from jQuery.Callbacks
     * @class Callbacks
     * @namespace util
     * @constructor
     * @param {String|Object} options An optional list of space-separated options that will change how the callback list behaves or a more traditional option object
     * @param {Boolean} once Will ensure the callback list can only be fired once (like a Deferred)
     * @param {Boolean} memory Will keep track of previous values and will call any callback added after the list has been fired right away with the latest 'memorized' values (like a Deferred)
     * @param {Boolean} unique Will ensure a callback can only be added once (no duplicate in the list)
     * @param {Boolean} stopOnFalse Interrupt callings when a callback returns false
     * @example
     *  var list = Callbacks('once memory');
     */
    module.exports = function(options) {
        // Convert options from String-formatted to Object-formatted if needed
        // (we check in cache first)
        options = typeof options === 'string' ?
            (optionsCache[options] || createOptions(options)) :
            extend({}, options);

        var // Flag to know if list is currently firing
            firing,
            // Last fire value (for non-forgettable lists)
            memory,
            // Flag to know if list was already fired
            fired,
            // End of the loop when firing
            firingLength,
            // Index of currently firing callback (modified by remove if needed)
            firingIndex,
            // First callback to fire (used internally by add and fireWith)
            firingStart,
            // Actual callback list
            list = [],
            // Stack of fire calls for repeatable lists
            stack = !options.once && [],
            // Fire callbacks
            fire = function(data) {
                memory = options.memory && data;
                fired = true;
                firingIndex = firingStart || 0;
                firingStart = 0;
                firingLength = list.length;
                firing = true;
                for (; list && firingIndex < firingLength; firingIndex++) {
                    if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
                        memory = false; // To prevent further calls using add
                        break;
                    }
                }
                firing = false;
                if (list) {
                    if (stack) {
                        if (stack.length) {
                            fire(stack.shift());
                        }
                    } else if (memory) {
                        list = [];
                    } else {
                        self.disable();
                    }
                }
            },
            // Actual Callbacks object
            self = {
                /**
                 * Add a callback or a collection of callbacks to the list
                 * @method add
                 * @return {util.Callbacks}
                 */
                add: function() {
                    if (list) {
                        // First, we save the current length
                        var start = list.length;
                        (function add(args) {
                            _.forEach(args, function(arg) {
                                if (_.isFunction(arg)) {
                                    if (!options.unique || !self.has(arg)) {
                                        list.push(arg);
                                    }
                                } else if (arg && arg.length && _.isString(arg)) {
                                    // Inspect recursively
                                    add(arg);
                                }
                            });
                        })(arguments);
                        // Do we need to add the callbacks to the
                        // current firing batch?
                        if (firing) {
                            firingLength = list.length;
                            // With memory, if we're not firing then
                            // we should call right away
                        } else if (memory) {
                            firingStart = start;
                            fire(memory);
                        }
                    }
                    return this;
                },

                /**
                 * Remove a callback from the list
                 * @method remove
                 * @return {util.Callbacks}
                 */
                remove: function() {
                    if (list) {
                        _.forEach(arguments, function(arg) {
                            var index;
                            while ((index = _.indexOf(arg, list, index)) > -1) {
                                list.splice(index, 1);
                                // Handle firing indexes
                                if (firing) {
                                    if (index <= firingLength) {
                                        firingLength--;
                                    }
                                    if (index <= firingIndex) {
                                        firingIndex--;
                                    }
                                }
                            }
                        });
                    }
                    return this;
                },

                /**
                 * Check if a given callback is in the list.
                 * If no argument is given, return whether or not list has callbacks attached.
                 * @method has
                 * @return {util.Callbacks}
                 */
                has: function(fn) {
                    return fn ? _.indexOf(fn, list) > -1 : !!(list && list.length);
                },

                /**
                 * Remove all callbacks from the list
                 * @method empty
                 * @return {util.Callbacks}
                 */
                empty: function() {
                    list = [];
                    firingLength = 0;
                    return this;
                },

                /**
                 * Have the list do nothing anymore
                 * @method disable
                 * @return {util.Callbacks}
                 */
                disable: function() {
                    list = stack = memory = undefined;
                    return this;
                },

                /**
                 * Is it disabled?
                 * @method disabled
                 * @return {util.Callbacks}
                 */
                disabled: function() {
                    return !list;
                },

                /**
                 * Lock the list in its current state
                 * @method lock
                 * @return {util.Callbacks}
                 */
                lock: function() {
                    stack = undefined;
                    if (!memory) {
                        self.disable();
                    }
                    return this;
                },

                /**
                 * Is it locked?
                 * @method locked
                 * @return {Boolean}
                 */
                locked: function() {
                    return !stack;
                },

                /**
                 * Call all callbacks with the given context and arguments
                 * @method fireWith
                 * @return {util.Callbacks}
                 */
                fireWith: function(context, args) {
                    if (list && (!fired || stack)) {
                        args = args || [];
                        args = [context, args.slice ? args.slice() : args];
                        if (firing) {
                            stack.push(args);
                        } else {
                            fire(args);
                        }
                    }
                    return this;
                },

                /**
                 * Call all the callbacks with the given arguments
                 * @method fire
                 * @return {util.Callbacks}
                 */
                fire: function() {
                    self.fireWith(this, arguments);
                    return this;
                },

                /**
                 * To know if the callbacks have already been called at least once
                 * @method fired
                 * @return {util.Callbacks}
                 */
                fired: function() {
                    return !!fired;
                }
            };

        return self;
    };
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Class', function(require, exports, module){
    var _ = require('util.underscore'),
        extend = require('util.extend'),
        $ = require('lib.Zepto');

    /**
     * Base Class
     * @class Class
     * @namespace lang
     * @module lang
     * @constructor
     * @example
     *      // SubClass extends Class
     *      var SubClass = Class.extend({
     *          // overwritten constructor
     *          initialize: function(){
     *
     *          },
     *
     *          someMethod: function(){
     *          }
     *      });
     *
     *      // add static methods and attributes
     *      SubClass.include({
     *          staticMethod: function(){
     *          },
     *
     *          staticAttr: 'attrValue'
     *      });
     *
     *      // Extension is always available for sub class
     *      var SubSubClass = SubClass.extend({
     *          // methods to be extended
     *      });
     */
    module.exports = inherit.call(Function, {
        initialize: function(){},

        /**
         * Mix in methods and attributes. Instead of inherit from base class, mix provides a lighter way to extend object.
         * @method mixin
         * @since 0.5.2
         * @param {Object} [mixin]* The object to be mixed in
         * @chainable
         * @example
         *      var someInstance = new Class;
         *
         *      someInstance.mix({
         *          sayHello: function(){
         *              alert('hello');
         *          }
         *      });
         */
        mixin: include
    });

    function inherit(ext){
        // prepare extends
        var args = _.toArray(arguments);

        // constructor
        var Class = function(){
            // real constructor
            this.initialize.apply(this, arguments);
        };

        // copy Base.prototype
        var Base = function(){};
        Base.prototype = this.prototype;
        var proto = new Base();

        // correct constructor pointer
        /**
         * Instance's constructor, which initialized the instance
         * @property constructor
         * @for lang.Class
         * @type {lang.Class}
         */
        proto.constructor = Class;

        /**
         * Superclass of the instance
         * @property superclass
         * @type {lang.Class}
         */
        proto.superclass = this;

        // extends prototype
        args.unshift(proto);
        extend.apply(args, args);
        Class.prototype = proto;

        // add static methods
        extend(Class, {
            /**
             * Extend a sub Class
             * @method inherit
             * @static
             * @for lang.Class
             * @param {Object} [ext]* Prototype extension. Multiple exts are allow here.
             * @chainable
             * @example
             *     var SubClass = Class.extend(ext1);
             *
             * @example
             *      // multiple extensions are acceptable
             *      var SubClass = Class.extend(ext1, ext2, ...);
             */
            inherit: inherit,

            /**
             * Extend static attributes
             * @method include
             * @static
             * @for lang.Class
             * @param {Object} [included]* Static attributes to be extended
             * @chainable
             * @example
             *     Class.include(include1);
             *
             * @example
             *     // multiple includes are acceptable
             *     Class.include(include1, include2, ...);
             */
            include: include,

            /**
             * Inherit base class and add/overwritten some new methods or properties.
             * This is a deprecated method for it's easily misunderstood. It's just for backward compatible use and will be removed in the near future.
             * We recommend inherit for a replacement
             * @method extend
             * @static
             * @for lang.Class
             * @deprecated
             * @see inherit
             */
            extend: inherit,

            /**
             * Superclass the Class inherited from
             * @property superclass
             * @type {lang.Class}
             * @for lang.Class
             */
            superclass: this
        });

        return Class;
    };

    function include(included){
        var args = _.toArray(arguments);
        args.unshift(this);
        extend.apply(this, args);
        return this;
    }
});
/**
 * @fileOverview
 * @author amoschen
 * @version 1
 * Created: 12-8-27 下午8:26
 */
MLBF.define('util.Cookie', function() {
    var doc = document;

    /**
     * Cookie utilities
     * @class Cookie
     * @namespace util
     * @module util
     */
    return {
        /**
         * Set a cookie item
         * @method set
         * @static
         * @param {String} name Cookie name
         * @param {*} value Cookie value
         * @param {String} [domain=fullDomain] The domain cookie store in
         * @param {String} [path=currentPath] The path cookie store in
         * @param {Date} [expires=sessionTime] The expire time of cookie
         * @chainable
         */
        set: function(name, value, domain, path, expires) {
            if (expires) {
                expires = new Date(+new Date() + expires);
            }

            var tempcookie = name + '=' + escape(value) +
                ((expires) ? '; expires=' + expires.toGMTString() : '') +
                ((path) ? '; path=' + path : '') +
                ((domain) ? '; domain=' + domain : '');

            //Ensure the cookie's size is under the limitation
            if (tempcookie.length < 4096) {
                doc.cookie = tempcookie;
            }

            return this;
        },

        /**
         * Get value of a cookie item
         * @method get
         * @static
         * @param {String} name Cookie name
         * @return {String|Null}
         */
        get: function(name) {
            var carr = doc.cookie.match(new RegExp("(^| )" + name + "=([^;]*)(;|$)"));
            if (carr != null) {
                return unescape(carr[2]);
            }

            return null;
        },

        /**
         * Delete a cookie item
         * @method del
         * @static
         * @param {String} name Cookie name
         * @param {String} [domain=fullDomain] The domain cookie store in
         * @param {String} [path=currentPath] The path cookie store in
         * @chainable
         */
        del: function(name, domain, path) {
            if (this.get(name)) {
                doc.cookie = name + '=' +
                    ((path) ? '; path=' + path : '') +
                    ((domain) ? '; domain=' + domain : '') +
                    ";expires=Thu, 01-Jan-1970 00:00:01 GMT";
            }

            return this;
        },

        /**
         * Find certain string in cookie with regexp
         * @method find
         * @static
         * @param {RegExp} pattern
         * @return {Array|Null} RegExp matches
         * @example
         *      // assume cookie is like below
         *      // ts_uid=5458535332; ptui_loginuin=mice530@qq.com; Hm_lvt_bb8beb2d26e5d753995874b8b827291d=1367826377,1369234241;
         *      Cookie.find(/ptui_loginuin=([\S]*);/); // returns ["ptui_loginuin=mice530@qq.com;", "mice530@qq.com"]
         */
        find: function(pattern) {
            return doc.cookie.match(pattern);
        }
    };
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Event', function(require, exports) {
    var _ = require('util.underscore'),
        Callbacks = require('util.Callbacks');

    var ATTR = '_EVENTS';

    /**
     * [mixable] Common event handler. Can be extended to any object that wants event handler.
     * @class Event
     * @namespace util
     * @example
     *      // mix in instance example
     *      // assume classInstance is instance of lang.Class or its sub class
     *
     *      // use class's mix method
     *      classInstance.mix(Attribute);
     *
     *      // set your attributes
     *      classInstance.set('a', 1);
     *      classInstance.get('a') // returns 1
     *
     * @example
     *      // extend a sub class example
     *
     *      // use class's extend method
     *      var SubClass = Class.extend(Attribute, {
     *          // some other methods
     *          method1: function(){
     *          },
     *
     *          method2: function(){
     *          }
     *      });
     *
     *      // initialize an instance
     *      classInstance = new SubClass;
     *
     *      // set your attributes
     *      classInstance.set('a', 1);
     *      classInstance.get('a') // returns 1
     */

    /**
     * Bind events
     * @method on
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} callback Callback to be invoked when the subscribed events are published
     * @chainable
     */
    exports.on = function(type, handler, one) {
        var events = this[ATTR];

        if (!events) {
            events = this[ATTR] = {};
        }

        var callbacks = events[type] || (events[type] = Callbacks('stopOnFalse'));

        if (one === 1) {
            var origFn = handler,
                self = this;

            handler = function() {
                // Can use an empty set, since event contains the info
                self.off(type, handler);
                return origFn.apply(this, arguments);
            };
        }

        callbacks.add(handler);

        return this;
    }

    /**
     * Unbind events
     * @method off
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} [callback] Callback to be invoked when the subscribed events are published. Leave blank will unbind all callbacks on this event
     * @chainable
     */
    exports.off = function(type, handler) {
        if (!type) {
            this[ATTR] = {};
            return this;
        }

        var events = this[ATTR];
        if (!events || !events[type]) {
            return this;
        }

        if (!handler) {
            events[type].empty();
            return this;
        }

        events[type].remove(handler);

        return this;
    }

    /**
     * Publish an event
     * @method trigger
     * @param {String} eventName
     * @param arg* Arguments to be passed to callback function. No limit of arguments' length
     * @chainable
     */
    exports.trigger = function() {
        var args = _.toArray(arguments),
            type = args.shift(),
            events = this[ATTR];

        if (!events || !events[type]) {
            return this;
        }

        events[type].fireWith(this, args);

        return this;
    }

    /**
     * Bind event callback to be triggered only once
     * @method one
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} callback Callback to be invoked when the subscribed events are published. Leave blank will unbind all callbacks on this event
     * @chainable
     */
    exports.once = function(type, handler) {
        return this.on(type, handler, 1);
    }
});
MLBF.define('util.defaults', function( require ){
    var extend = require('util.extend');

    /**
     * Merge options with defaults, support multiple defaults
     * @method defaults
     * @param {Boolean} [isRecursive=false] Should recursive merge or not
     * @param {Object} options Options to be merged to
     * @param {Object} defaults* Defaults for options
     * @return {Object} Options merged with defaults.
     * @example
     *  var ret = defaults( { a: 1 }, { a: 2, b: 2, c: 2 }, { c: 3, d: 4 } );
     *
     *  // defaults won't override options
     *  ret.a === 2;
     *
     *  // the attribute unset in options will be filled with value in defaults
     *  ret.b === 2;
     *
     *  // the latter defaults will override previous one
     *  ret.c === 3;
     */
    return function(){
        var args = [].slice.call( arguments ),
            optPos = typeof args[0] === 'boolean' ? 1 : 0,
            options = args.splice( optPos, 1 )[0];

        // add target options
        args.splice( optPos, 0, {} );

        // move original options to tail
        args.push( options );

        return extend.apply( this, args );
    };
});
/**
 * Created by amos on 14-8-7.
 */
MLBF.define('util.extend', function(require, exports, module){
    var isPlainObject = require('util.isPlainObject');

    /**
     * Extend(copy) attributes from an object to another
     * @class extend
     * @namespace lang
     * @constructor
     * @param {Boolean} [isRecursive=false] Recursively extend the object
     * @param {Object} base Base object to be extended into
     * @param {Object} ext* Object to extend base object
     * @example
     *      // plain extend
     *      // returns {a: 1, b:1}
     *      extend({a: 1}, {b: 1});
     *
     *      // recursive extend
     *      var b = { x: 1};
     *      var ret = extend(true, {}, { b: b});
     *      b.x = 2;
     *      b.x !== ret.b.x;
     */
    module.exports = function(isRecursive, base, ext){
        var args = [].slice.apply(arguments),
            o = args.shift(),
            extFn = plain;

        if(typeof o === 'boolean'){
            o = args.shift();
            o && (extFn = recursive);
        }

        for(var i= 0, len= args.length; i< len; i++){
            args[i] && extFn(o, args[i]);
        }

        return o;

        function plain(o, ext){
            for(var attr in ext){
                if(ext.hasOwnProperty(attr)){
                    o[attr] = ext[attr];
                }
            }
        }

        function recursive(o, ext){
            for(var attr in ext){
                if(ext.hasOwnProperty(attr)){
                    if(isPlainObject(ext[attr])){
                        o[attr] = o[attr] || {};
                        recursive(o[attr], ext[attr]);
                    } else{
                        o[attr] = ext[attr];
                    }
                }
            }
        }
    };
});
MLBF.define('util.isPlainObject', function(require, exports, module) {
    var _ = require('util.underscore'),
        isWindow = function(obj) {
            return obj && obj === obj.window;
        };

    /**
     * Whether the obj is a plain object, not array or regexp etc.
     * @method isPlainObject
     * @static
     * @param {*} obj
     * @return {Boolean}
     */
    module.exports = function(obj) {
        // Must be an Object.
        // Because of IE, we also have to check the presence of the constructor property.
        // Make sure that DOM nodes and window objects don't pass through, as well
        if (!obj || !_.isObject(obj) || obj.nodeType || isWindow(obj)) {
            return false;
        }

        var hasOwn = Object.prototype.hasOwnProperty;

        try {
            // Not own constructor property must be Object
            if (obj.constructor &&
                !hasOwn.call(obj, 'constructor') &&
                !hasOwn.call(obj.constructor.prototype, 'isPrototypeOf')) {
                return false;
            }
        } catch (e) {
            // IE8,9 Will throw exceptions on certain host objects #9897
            return false;
        }

        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.

        var key;
        for (key in obj) {}

        return key === undefined || hasOwn.call(obj, key);
    };
});
/******************************************************************************
 * MLBF MVC 0.0.1 2015-05-26
 * author hongri
 ******************************************************************************/

/**
 * Art template, enhanced micro template. See
 <a target="_blank" href="https://github.com/aui/artTemplate">template API doc</a>
 * @class template
 * @namespace util
 * @module util
 */
MLBF.define('util.template', function(require, exports, module) {
    /** @ignore */
    /*!
     * artTemplate - Template Engine
     * https://github.com/aui/artTemplate
     * Released under the MIT, BSD, and GPL Licenses
     * Email: 1987.tangbin@gmail.com
     */


    /**
     * 模板引擎路由函数
     * 若第二个参数类型为 Object 则执行 render 方法, 否则 compile 方法
     * @name    template
     * @param   {String}            模板ID (可选)
     * @param   {Object, String}    数据或者模板字符串
     * @return  {String, Function}  渲染好的HTML字符串或者渲染方法
     */
    var template = function(id, content) {
        return template[
            typeof content === 'object' ? 'render' : 'compile'
        ].apply(template, arguments);
    };




    (function(exports, global) {


        'use strict';
        exports.version = '2.0.0';
        exports.openTag = '{%'; // 设置逻辑语法开始标签
        exports.closeTag = '%}'; // 设置逻辑语法结束标签
        exports.isEscape = true; // HTML字符编码输出开关
        exports.isCompress = false; // 剔除渲染后HTML多余的空白开关
        exports.parser = null; // 自定义语法插件接口



        /**
         * 渲染模板
         * @name    template.render
         * @param   {String}    模板ID
         * @param   {Object}    数据
         * @return  {String}    渲染好的HTML字符串
         */
        exports.render = function(id, data) {

            var cache = _getCache(id);

            if (cache === undefined) {

                return _debug({
                    id: id,
                    name: 'Render Error',
                    message: 'No Template'
                });

            }

            return cache(data);
        };



        /**
         * 编译模板
         * 2012-6-6:
         * define 方法名改为 compile,
         * 与 Node Express 保持一致,
         * 感谢 TooBug 提供帮助!
         * @name    template.compile
         * @param   {String}    模板ID (可选)
         * @param   {String}    模板字符串
         * @return  {Function}  渲染方法
         */
        exports.compile = function(id, source) {

            var params = arguments;
            var isDebug = params[2];
            var anonymous = 'anonymous';

            if (typeof source !== 'string') {
                isDebug = params[1];
                source = params[0];
                id = anonymous;
            }


            try {

                var Render = _compile(source, isDebug);

            } catch (e) {

                e.id = id || source;
                e.name = 'Syntax Error';

                return _debug(e);

            }


            function render(data) {

                try {

                    return new Render(data) + '';

                } catch (e) {

                    if (!isDebug) {
                        return exports.compile(id, source, true)(data);
                    }

                    e.id = id || source;
                    e.name = 'Render Error';
                    e.source = source;

                    return _debug(e);

                };

            };


            render.prototype = Render.prototype;
            render.toString = function() {
                return Render.toString();
            };


            if (id !== anonymous) {
                _cache[id] = render;
            }


            return render;

        };




        /**
         * 添加模板辅助方法
         * @name    template.helper
         * @param   {String}    名称
         * @param   {Function}  方法
         */
        exports.helper = function(name, helper) {
            exports.prototype[name] = helper;
        };




        /**
         * 模板错误事件
         * @name    template.onerror
         * @event
         */
        exports.onerror = function(e) {
            var content = '[template]:\n' + e.id + '\n\n[name]:\n' + e.name;

            if (e.message) {
                content += '\n\n[message]:\n' + e.message;
            }

            if (e.line) {
                content += '\n\n[line]:\n' + e.line;
                content += '\n\n[source]:\n' + e.source.split(/\n/)[e.line - 1].replace(/^[\s\t]+/, '');
            }

            if (e.temp) {
                content += '\n\n[temp]:\n' + e.temp;
            }

            if (global.console) {
                console.error(content);
            }
        };



        // 编译好的函数缓存
        var _cache = {};



        // 获取模板缓存
        var _getCache = function(id) {

            var cache = _cache[id];

            if (cache === undefined && 'document' in global) {
                var elem = document.getElementById(id);

                if (elem) {
                    var source = elem.value || elem.innerHTML;
                    return exports.compile(id, source.replace(/^\s*|\s*$/g, ''));
                }

            } else if (_cache.hasOwnProperty(id)) {

                return cache;
            }
        };



        // 模板调试器
        var _debug = function(e) {

            exports.onerror(e);

            function error() {
                return error + '';
            };

            error.toString = function() {
                return '{Template Error}';
            };

            return error;
        };



        // 模板编译器
        var _compile = (function() {


            // 辅助方法集合
            exports.prototype = {
                $render: exports.render,
                $escapeHTML: function(content) {

                    return typeof content === 'string' ? content.replace(/&(?![\w#]+;)|[<>"']/g, function(s) {
                        return {
                            "<": "&#60;",
                            ">": "&#62;",
                            '"': "&#34;",
                            "'": "&#39;",
                            "&": "&#38;"
                        }[s];
                    }) : content;
                },
                $specialCharEscapeHTML: function(content) {

                    return typeof content === 'string' ? content.replace(/(['"\\\/])/g, '\\$1') : content;
                },
                $getValue: function(value) {

                    if (typeof value === 'string' || typeof value === 'number') {

                        return value;

                    } else if (typeof value === 'function') {

                        return value();

                    } else {

                        return '';

                    }

                }
            };


            var arrayforEach = Array.prototype.forEach || function(block, thisObject) {
                var len = this.length >>> 0;

                for (var i = 0; i < len; i++) {
                    if (i in this) {
                        block.call(thisObject, this[i], i, this);
                    }
                }

            };


            // 数组迭代
            var forEach = function(array, callback) {
                arrayforEach.call(array, callback);
            };


            var keyWords =
                // 关键字
                'break,case,catch,continue,debugger,default,delete,do,else,false,finally,for,function,if' + ',in,instanceof,new,null,return,switch,this,throw,true,try,typeof,var,void,while,with'

            // 保留字
            +',abstract,boolean,byte,char,class,const,double,enum,export,extends,final,float,goto' + ',implements,import,int,interface,long,native,package,private,protected,public,short' + ',static,super,synchronized,throws,transient,volatile'

            // ECMA 5 - use strict
            + ',arguments,let,yield'

            + ',undefined';

            var filter = new RegExp([

                // 注释
                "/\\*(.|\n)*?\\*/|//[^\n]*\n|//[^\n]*$",

                // 字符串
                "'[^']*'|\"[^\"]*\"",

                // 方法
                "\\.[\s\t\n]*[\\$\\w]+",

                // 关键字
                "\\b" + keyWords.replace(/,/g, '\\b|\\b') + "\\b"


            ].join('|'), 'g');



            // 提取js源码中所有变量
            var _getVariable = function(code) {

                code = code
                    .replace(filter, ',')
                    .replace(/[^\w\$]+/g, ',')
                    .replace(/^,|^\d+|,\d+|,$/g, '');

                return code ? code.split(',') : [];
            };


            return function(source, isDebug) {

                var openTag = exports.openTag;
                var closeTag = exports.closeTag;
                var parser = exports.parser;


                var code = source;
                var tempCode = '';
                var line = 1;
                var uniq = {
                    $data: true,
                    $helpers: true,
                    $out: true,
                    $line: true
                };
                var helpers = exports.prototype;
                var prototype = {};


                var variables = "var $helpers=this," + (isDebug ? "$line=0," : "");

                var isNewEngine = ''.trim; // '__proto__' in {}
                var replaces = isNewEngine ? ["$out='';", "$out+=", ";", "$out"] : ["$out=[];", "$out.push(", ");", "$out.join('')"];

                var concat = isNewEngine ? "if(content!==undefined){$out+=content;return content}" : "$out.push(content);";

                var print = "function(content){" + concat + "}";

                var include = "function(id,data){" + "if(data===undefined){data=$data}" + "var content=$helpers.$render(id,data);" + concat + "}";


                // html与逻辑语法分离
                forEach(code.split(openTag), function(code, i) {
                    code = code.split(closeTag);

                    var $0 = code[0];
                    var $1 = code[1];

                    // code: [html]
                    if (code.length === 1) {

                        tempCode += html($0);

                        // code: [logic, html]
                    } else {

                        tempCode += logic($0);

                        if ($1) {
                            tempCode += html($1);
                        }
                    }


                });



                code = tempCode;


                // 调试语句
                if (isDebug) {
                    code = 'try{' + code + '}catch(e){' + 'e.line=$line;' + 'throw e' + '}';
                }


                code = "'use strict';" + variables + replaces[0] + code + 'return new String(' + replaces[3] + ')';


                try {

                    var Render = new Function('$data', code);
                    Render.prototype = prototype;

                    return Render;

                } catch (e) {
                    e.temp = 'function anonymous($data) {' + code + '}';
                    throw e;
                };




                // 处理 HTML 语句
                function html(code) {

                    // 记录行号
                    line += code.split(/\n/).length - 1;

                    if (exports.isCompress) {
                        code = code.replace(/[\n\r\t\s]+/g, ' ');
                    }

                    code = code
                        // 单双引号与反斜杠转义
                        .replace(/('|"|\\)/g, '\\$1')
                        // 换行符转义(windows + linux)
                        .replace(/\r/g, '\\r')
                        .replace(/\n/g, '\\n');

                    code = replaces[1] + "'" + code + "'" + replaces[2];

                    return code + '\n';
                };


                // 处理逻辑语句
                function logic(code) {

                    var thisLine = line;

                    if (parser) {

                        // 语法转换插件钩子
                        code = parser(code);

                    } else if (isDebug) {

                        // 记录行号
                        code = code.replace(/\n/g, function() {
                            line++;
                            return '$line=' + line + ';';
                        });

                    }


                    // 输出语句. 转义: <%=value%> 不转义:<%==value%>
                    if (code.indexOf('=') === 0) {

                        var isEscape = code.indexOf('==') !== 0;

                        var isSpecialCharEscape = code.indexOf('#=') === 0;

                        code = code.replace(/^=*|[\s;]*$/g, '');

                        if ((isEscape || isSpecialCharEscape) && exports.isEscape) {

                            // 转义处理，但排除辅助方法
                            var name = code.replace(/\s*\([^\)]+\)/, '');
                            if (!helpers.hasOwnProperty(name) && !/^(include|print)$/.test(name)) {
                                code = (isSpecialCharEscape ? '$specialCharEscapeHTML' : '$escapeHTML') + '($getValue(' + code + '))';
                            }

                        } else {
                            code = '$getValue(' + code + ')';
                        }


                        code = replaces[1] + code + replaces[2];

                    }

                    if (isDebug) {
                        code = '$line=' + thisLine + ';' + code;
                    }

                    getKey(code);

                    return code + '\n';
                };


                // 提取模板中的变量名
                function getKey(code) {

                    code = _getVariable(code);

                    // 分词
                    forEach(code, function(name) {

                        // 除重
                        if (!uniq.hasOwnProperty(name)) {
                            setValue(name);
                            uniq[name] = true;
                        }

                    });

                };


                // 声明模板变量
                // 赋值优先级:
                // 内置特权方法(include, print) > 私有模板辅助方法 > 数据 > 公用模板辅助方法
                function setValue(name) {

                    var value;

                    if (name === 'print') {

                        value = print;

                    } else if (name === 'include') {

                        prototype['$render'] = helpers['$render'];
                        value = include;

                    } else {

                        value = '$data.' + name;

                        if (helpers.hasOwnProperty(name)) {

                            prototype[name] = helpers[name];

                            if (name.indexOf('$') === 0) {
                                value = '$helpers.' + name;
                            } else {
                                value = value + '===undefined?$helpers.' + name + ':' + value;
                            }
                        }


                    }

                    variables += name + '=' + value + ',';
                };


            };
        })();




    })(template, window);


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = template;
    }
});
/******************************************************************************
 * MLBF Node 0.0.1 2015-05-26
 * is only core function of underscore
 ******************************************************************************/

/** @ignore */
MLBF.define('util.underscore', function(require, exports, module) {

    // Baseline setup
    // --------------

    // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
    // We use `self` instead of `window` for `WebWorker` support.
    var root = typeof self === 'object' && self.self === self && self ||
        typeof global === 'object' && global.global === global && global;

    // Save the previous value of the `_` variable.
    var previousUnderscore = root._;

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto = Array.prototype,
        ObjProto = Object.prototype,
        FuncProto = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var
        push = ArrayProto.push,
        slice = ArrayProto.slice,
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
        nativeIsArray = Array.isArray,
        nativeKeys = Object.keys,
        nativeBind = FuncProto.bind,
        nativeCreate = Object.create;

    // Naked function reference for surrogate-prototype-swapping.
    var Ctor = function() {};

    // Create a safe reference to the Underscore object for use below.
    var _ = function(obj) {
        if (obj instanceof _) return obj;
        if (!(this instanceof _)) return new _(obj);
        this._wrapped = obj;
    };

    // Export the Underscore object for **Node.js**, with
    // backwards-compatibility for their old module API. If we're in
    // the browser, add `_` as a global object.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = _;
        }
        exports._ = _;
    } else {
        root._ = _;
    }

    // Current version.
    _.VERSION = '1.8.3';

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    var optimizeCb = function(func, context, argCount) {
        if (context === void 0) return func;
        switch (argCount == null ? 3 : argCount) {
            case 1:
                return function(value) {
                    return func.call(context, value);
                };
            case 2:
                return function(value, other) {
                    return func.call(context, value, other);
                };
            case 3:
                return function(value, index, collection) {
                    return func.call(context, value, index, collection);
                };
            case 4:
                return function(accumulator, value, index, collection) {
                    return func.call(context, accumulator, value, index, collection);
                };
        }
        return function() {
            return func.apply(context, arguments);
        };
    };

    // A mostly-internal function to generate callbacks that can be applied
    // to each element in a collection, returning the desired result — either
    // identity, an arbitrary callback, a property matcher, or a property accessor.
    var cb = function(value, context, argCount) {
        if (value == null) return _.identity;
        if (_.isFunction(value)) return optimizeCb(value, context, argCount);
        if (_.isObject(value)) return _.matcher(value);
        return _.property(value);
    };
    _.iteratee = function(value, context) {
        return cb(value, context, Infinity);
    };

    // Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
    // This accumulates the arguments passed into an array, after a given index.
    var restArgs = function(func, startIndex) {
        startIndex = startIndex == null ? func.length - 1 : +startIndex;
        return function() {
            var length = Math.max(arguments.length - startIndex, 0);
            var rest = Array(length);
            var index;
            for (index = 0; index < length; index++) {
                rest[index] = arguments[index + startIndex];
            }
            switch (startIndex) {
                case 0:
                    return func.call(this, rest);
                case 1:
                    return func.call(this, arguments[0], rest);
                case 2:
                    return func.call(this, arguments[0], arguments[1], rest);
            }
            var args = Array(startIndex + 1);
            for (index = 0; index < startIndex; index++) {
                args[index] = arguments[index];
            }
            args[startIndex] = rest;
            return func.apply(this, args);
        };
    };

    // An internal function for creating a new object that inherits from another.
    var baseCreate = function(prototype) {
        if (!_.isObject(prototype)) return {};
        if (nativeCreate) return nativeCreate(prototype);
        Ctor.prototype = prototype;
        var result = new Ctor;
        Ctor.prototype = null;
        return result;
    };

    var property = function(key) {
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        };
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
    var getLength = property('length');
    var isArrayLike = function(collection) {
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // Collection Functions
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    _.each = _.forEach = function(obj, iteratee, context) {
        iteratee = optimizeCb(iteratee, context);
        var i, length;
        if (isArrayLike(obj)) {
            for (i = 0, length = obj.length; i < length; i++) {
                iteratee(obj[i], i, obj);
            }
        } else {
            var keys = _.keys(obj);
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
            }
        }
        return obj;
    };

    // Return the results of applying the iteratee to each element.
    _.map = _.collect = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length,
            results = Array(length);
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            results[index] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Create a reducing function iterating left or right.
    var createReduce = function(dir) {
        // Optimized iterator function as using arguments.length
        // in the main function will deoptimize the, see #1991.
        var reducer = function(obj, iteratee, memo, initial) {
            var keys = !isArrayLike(obj) && _.keys(obj),
                length = (keys || obj).length,
                index = dir > 0 ? 0 : length - 1;
            if (!initial) {
                memo = obj[keys ? keys[index] : index];
                index += dir;
            }
            for (; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }
            return memo;
        };

        return function(obj, iteratee, memo, context) {
            var initial = arguments.length >= 3;
            return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
        };
    };

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    _.reduce = _.foldl = _.inject = createReduce(1);

    // The right-associative version of reduce, also known as `foldr`.
    _.reduceRight = _.foldr = createReduce(-1);

    // Return the first value which passes a truth test. Aliased as `detect`.
    _.find = _.detect = function(obj, predicate, context) {
        var key;
        if (isArrayLike(obj)) {
            key = _.findIndex(obj, predicate, context);
        } else {
            key = _.findKey(obj, predicate, context);
        }
        if (key !== void 0 && key !== -1) return obj[key];
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    _.filter = _.select = function(obj, predicate, context) {
        var results = [];
        predicate = cb(predicate, context);
        _.each(obj, function(value, index, list) {
            if (predicate(value, index, list)) results.push(value);
        });
        return results;
    };

    // Return all the elements for which a truth test fails.
    _.reject = function(obj, predicate, context) {
        return _.filter(obj, _.negate(cb(predicate)), context);
    };

    // Determine whether all of the elements match a truth test.
    // Aliased as `all`.
    _.every = _.all = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (!predicate(obj[currentKey], currentKey, obj)) return false;
        }
        return true;
    };

    // Determine if at least one element in the object matches a truth test.
    // Aliased as `any`.
    _.some = _.any = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return false;
    };

    // Determine if the array or object contains a given item (using `===`).
    // Aliased as `includes` and `include`.
    _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
        if (!isArrayLike(obj)) obj = _.values(obj);
        if (typeof fromIndex != 'number' || guard) fromIndex = 0;
        return _.indexOf(obj, item, fromIndex) >= 0;
    };

    // Invoke a method (with arguments) on every item in a collection.
    _.invoke = restArgs(function(obj, method, args) {
        var isFunc = _.isFunction(method);
        return _.map(obj, function(value) {
            var func = isFunc ? method : value[method];
            return func == null ? func : func.apply(value, args);
        });
    });

    // Convenience version of a common use case of `map`: fetching a property.
    _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    _.where = function(obj, attrs) {
        return _.filter(obj, _.matcher(attrs));
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    _.findWhere = function(obj, attrs) {
        return _.find(obj, _.matcher(attrs));
    };

    // Return the maximum element (or element-based computation).
    _.max = function(obj, iteratee, context) {
        var result = -Infinity,
            lastComputed = -Infinity,
            value, computed;
        if (iteratee == null && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value > result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(v, index, list) {
                computed = iteratee(v, index, list);
                if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                    result = v;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // Return the minimum element (or element-based computation).
    _.min = function(obj, iteratee, context) {
        var result = Infinity,
            lastComputed = Infinity,
            value, computed;
        if (iteratee == null && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value < result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(v, index, list) {
                computed = iteratee(v, index, list);
                if (computed < lastComputed || computed === Infinity && result === Infinity) {
                    result = v;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // Shuffle a collection.
    _.shuffle = function(obj) {
        return _.sample(obj, Infinity);
    };

    // Sample **n** random values from a collection using the modern version of the
    // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `map`.
    _.sample = function(obj, n, guard) {
        if (n == null || guard) {
            if (!isArrayLike(obj)) obj = _.values(obj);
            return obj[_.random(obj.length - 1)];
        }
        var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
        var length = getLength(sample);
        n = Math.max(Math.min(n, length), 0);
        var last = length - 1;
        for (var index = 0; index < n; index++) {
            var rand = _.random(index, last);
            var temp = sample[index];
            sample[index] = sample[rand];
            sample[rand] = temp;
        }
        return sample.slice(0, n);
    };

    // Sort the object's values by a criterion produced by an iteratee.
    _.sortBy = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        return _.pluck(_.map(obj, function(value, index, list) {
            return {
                value: value,
                index: index,
                criteria: iteratee(value, index, list)
            };
        }).sort(function(left, right) {
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b) {
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index - right.index;
        }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    var group = function(behavior, partition) {
        return function(obj, iteratee, context) {
            var result = partition ? [
                [],
                []
            ] : {};
            iteratee = cb(iteratee, context);
            _.each(obj, function(value, index) {
                var key = iteratee(value, index, obj);
                behavior(result, value, key);
            });
            return result;
        };
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    _.groupBy = group(function(result, value, key) {
        if (_.has(result, key)) result[key].push(value);
        else result[key] = [value];
    });

    // Indexes the object's values by a criterion, similar to `groupBy`, but for
    // when you know that your index values will be unique.
    _.indexBy = group(function(result, value, key) {
        result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _.countBy = group(function(result, value, key) {
        if (_.has(result, key)) result[key]++;
        else result[key] = 1;
    });

    // Safely create a real, live array from anything iterable.
    _.toArray = function(obj) {
        if (!obj) return [];
        if (_.isArray(obj)) return slice.call(obj);
        if (isArrayLike(obj)) return _.map(obj, _.identity);
        return _.values(obj);
    };

    // Return the number of elements in an object.
    _.size = function(obj) {
        if (obj == null) return 0;
        return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    // Split a collection into two arrays: one whose elements all satisfy the given
    // predicate, and one whose elements all do not satisfy the predicate.
    _.partition = group(function(result, value, pass) {
        result[pass ? 0 : 1].push(value);
    }, true);

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    _.first = _.head = _.take = function(array, n, guard) {
        if (array == null) return void 0;
        if (n == null || guard) return array[0];
        return _.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    _.initial = function(array, n, guard) {
        return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    _.last = function(array, n, guard) {
        if (array == null) return void 0;
        if (n == null || guard) return array[array.length - 1];
        return _.rest(array, Math.max(0, array.length - n));
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array.
    _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, n == null || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    _.compact = function(array) {
        return _.filter(array, _.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    var flatten = function(input, shallow, strict) {
        var output = [],
            idx = 0;
        for (var i = 0, length = getLength(input); i < length; i++) {
            var value = input[i];
            if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
                //flatten current level of array or arguments object
                if (!shallow) value = flatten(value, shallow, strict);
                var j = 0,
                    len = value.length;
                output.length += len;
                while (j < len) {
                    output[idx++] = value[j++];
                }
            } else if (!strict) {
                output[idx++] = value;
            }
        }
        return output;
    };

    // Flatten out an array, either recursively (by default), or just one level.
    _.flatten = function(array, shallow) {
        return flatten(array, shallow, false);
    };

    // Return a version of the array that does not contain the specified value(s).
    _.without = restArgs(function(array, otherArrays) {
        return _.difference(array, otherArrays);
    });

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    _.uniq = _.unique = function(array, isSorted, iteratee, context) {
        if (!_.isBoolean(isSorted)) {
            context = iteratee;
            iteratee = isSorted;
            isSorted = false;
        }
        if (iteratee != null) iteratee = cb(iteratee, context);
        var result = [];
        var seen = [];
        for (var i = 0, length = getLength(array); i < length; i++) {
            var value = array[i],
                computed = iteratee ? iteratee(value, i, array) : value;
            if (isSorted) {
                if (!i || seen !== computed) result.push(value);
                seen = computed;
            } else if (iteratee) {
                if (!_.contains(seen, computed)) {
                    seen.push(computed);
                    result.push(value);
                }
            } else if (!_.contains(result, value)) {
                result.push(value);
            }
        }
        return result;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _.union = restArgs(function(arrays) {
        return _.uniq(flatten(arrays, true, true));
    });

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    _.intersection = function(array) {
        var result = [];
        var argsLength = arguments.length;
        for (var i = 0, length = getLength(array); i < length; i++) {
            var item = array[i];
            if (_.contains(result, item)) continue;
            var j;
            for (j = 1; j < argsLength; j++) {
                if (!_.contains(arguments[j], item)) break;
            }
            if (j === argsLength) result.push(item);
        }
        return result;
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    _.difference = restArgs(function(array, rest) {
        rest = flatten(rest, true, true);
        return _.filter(array, function(value) {
            return !_.contains(rest, value);
        });
    });

    // Complement of _.zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices
    _.unzip = function(array) {
        var length = array && _.max(array, getLength).length || 0;
        var result = Array(length);

        for (var index = 0; index < length; index++) {
            result[index] = _.pluck(array, index);
        }
        return result;
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    _.zip = restArgs(_.unzip);

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    _.object = function(list, values) {
        var result = {};
        for (var i = 0, length = getLength(list); i < length; i++) {
            if (values) {
                result[list[i]] = values[i];
            } else {
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // Generator function to create the findIndex and findLastIndex functions
    var createPredicateIndexFinder = function(dir) {
        return function(array, predicate, context) {
            predicate = cb(predicate, context);
            var length = getLength(array);
            var index = dir > 0 ? 0 : length - 1;
            for (; index >= 0 && index < length; index += dir) {
                if (predicate(array[index], index, array)) return index;
            }
            return -1;
        };
    };

    // Returns the first index on an array-like that passes a predicate test
    _.findIndex = createPredicateIndexFinder(1);
    _.findLastIndex = createPredicateIndexFinder(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    _.sortedIndex = function(array, obj, iteratee, context) {
        iteratee = cb(iteratee, context, 1);
        var value = iteratee(obj);
        var low = 0,
            high = getLength(array);
        while (low < high) {
            var mid = Math.floor((low + high) / 2);
            if (iteratee(array[mid]) < value) low = mid + 1;
            else high = mid;
        }
        return low;
    };

    // Generator function to create the indexOf and lastIndexOf functions
    var createIndexFinder = function(dir, predicateFind, sortedIndex) {
        return function(array, item, idx) {
            var i = 0,
                length = getLength(array);
            if (typeof idx == 'number') {
                if (dir > 0) {
                    i = idx >= 0 ? idx : Math.max(idx + length, i);
                } else {
                    length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
                }
            } else if (sortedIndex && idx && length) {
                idx = sortedIndex(array, item);
                return array[idx] === item ? idx : -1;
            }
            if (item !== item) {
                idx = predicateFind(slice.call(array, i, length), _.isNaN);
                return idx >= 0 ? idx + i : -1;
            }
            for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                if (array[idx] === item) return idx;
            }
            return -1;
        };
    };

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    _.range = function(start, stop, step) {
        if (stop == null) {
            stop = start || 0;
            start = 0;
        }
        step = step || 1;

        var length = Math.max(Math.ceil((stop - start) / step), 0);
        var range = Array(length);

        for (var idx = 0; idx < length; idx++, start += step) {
            range[idx] = start;
        }

        return range;
    };

    // Function (ahem) Functions
    // ------------------

    // Determines whether to execute a function as a constructor
    // or a normal function with the provided arguments
    var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
        if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
        var self = baseCreate(sourceFunc.prototype);
        var result = sourceFunc.apply(self, args);
        if (_.isObject(result)) return result;
        return self;
    };

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function(func, context) {
        if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
        var args = slice.call(arguments, 2);
        var bound = restArgs(function(callArgs) {
            return executeBound(func, bound, context, this, args.concat(callArgs));
        });
        return bound;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder by default, allowing any combination of arguments to be
    // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
    _.partial = restArgs(function(func, boundArgs) {
        var placeholder = _.partial.placeholder;
        var bound = function() {
            var position = 0,
                length = boundArgs.length;
            var args = Array(length);
            for (var i = 0; i < length; i++) {
                args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
            }
            while (position < arguments.length) args.push(arguments[position++]);
            return executeBound(func, bound, this, this, args);
        };
        return bound;
    });

    _.partial.placeholder = _;

    // Bind a number of an object's methods to that object. Remaining arguments
    // are the method names to be bound. Useful for ensuring that all callbacks
    // defined on an object belong to it.
    _.bindAll = restArgs(function(obj, keys) {
        keys = flatten(keys, false, false);
        var index = keys.length;
        if (index < 1) throw new Error('bindAll must be passed function names');
        while (index--) {
            var key = keys[index];
            obj[key] = _.bind(obj[key], obj);
        }
    });

    // Memoize an expensive function by storing its results.
    _.memoize = function(func, hasher) {
        var memoize = function(key) {
            var cache = memoize.cache;
            var address = '' + (hasher ? hasher.apply(this, arguments) : key);
            if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
            return cache[address];
        };
        memoize.cache = {};
        return memoize;
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    _.delay = restArgs(function(func, wait, args) {
        return setTimeout(function() {
            return func.apply(null, args);
        }, wait);
    });

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    _.defer = _.partial(_.delay, _, 1);

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time. Normally, the throttled function will run
    // as much as it can, without ever going more than once per `wait` duration;
    // but if you'd like to disable the execution on the leading edge, pass
    // `{leading: false}`. To disable execution on the trailing edge, ditto.
    _.throttle = function(func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        if (!options) options = {};
        var later = function() {
            previous = options.leading === false ? 0 : _.now();
            timeout = null;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        };
        return function() {
            var now = _.now();
            if (!previous && options.leading === false) previous = now;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                result = func.apply(context, args);
                if (!timeout) context = args = null;
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    _.debounce = function(func, wait, immediate) {
        var timeout, args, context, timestamp, result;

        var later = function() {
            var last = _.now() - timestamp;

            if (last < wait && last >= 0) {
                timeout = setTimeout(later, wait - last);
            } else {
                timeout = null;
                if (!immediate) {
                    result = func.apply(context, args);
                    if (!timeout) context = args = null;
                }
            }
        };

        return function() {
            context = this;
            args = arguments;
            timestamp = _.now();
            var callNow = immediate && !timeout;
            if (!timeout) timeout = setTimeout(later, wait);
            if (callNow) {
                result = func.apply(context, args);
                context = args = null;
            }

            return result;
        };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    _.wrap = function(func, wrapper) {
        return _.partial(wrapper, func);
    };

    // Returns a negated version of the passed-in predicate.
    _.negate = function(predicate) {
        return function() {
            return !predicate.apply(this, arguments);
        };
    };

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    _.compose = function() {
        var args = arguments;
        var start = args.length - 1;
        return function() {
            var i = start;
            var result = args[start].apply(this, arguments);
            while (i--) result = args[i].call(this, result);
            return result;
        };
    };

    // Returns a function that will only be executed on and after the Nth call.
    _.after = function(times, func) {
        return function() {
            if (--times < 1) {
                return func.apply(this, arguments);
            }
        };
    };

    // Returns a function that will only be executed up to (but not including) the Nth call.
    _.before = function(times, func) {
        var memo;
        return function() {
            if (--times > 0) {
                memo = func.apply(this, arguments);
            }
            if (times <= 1) func = null;
            return memo;
        };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _.once = _.partial(_.before, 2);

    _.restArgs = restArgs;

    // Object Functions
    // ----------------

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    var hasEnumBug = !{
        toString: null
    }.propertyIsEnumerable('toString');
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'
    ];

    var collectNonEnumProps = function(obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var constructor = obj.constructor;
        var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

        // Constructor is a special case.
        var prop = 'constructor';
        if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

        while (nonEnumIdx--) {
            prop = nonEnumerableProps[nonEnumIdx];
            if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
                keys.push(prop);
            }
        }
    };

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _.keys = function(obj) {
        if (!_.isObject(obj)) return [];
        if (nativeKeys) return nativeKeys(obj);
        var keys = [];
        for (var key in obj)
            if (_.has(obj, key)) keys.push(key);
            // Ahem, IE < 9.
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    // Retrieve all the property names of an object.
    _.allKeys = function(obj) {
        if (!_.isObject(obj)) return [];
        var keys = [];
        for (var key in obj) keys.push(key);
        // Ahem, IE < 9.
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    // Retrieve the values of an object's properties.
    _.values = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[keys[i]];
        }
        return values;
    };

    // Returns the results of applying the iteratee to each element of the object
    // In contrast to _.map it returns an object
    _.mapObject = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        var keys = _.keys(obj),
            length = keys.length,
            results = {};
        for (var index = 0; index < length; index++) {
            var currentKey = keys[index];
            results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Convert an object into a list of `[key, value]` pairs.
    _.pairs = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = Array(length);
        for (var i = 0; i < length; i++) {
            pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    _.invert = function(obj) {
        var result = {};
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
            result[obj[keys[i]]] = keys[i];
        }
        return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    _.functions = _.methods = function(obj) {
        var names = [];
        for (var key in obj) {
            if (_.isFunction(obj[key])) names.push(key);
        }
        return names.sort();
    };

    // An internal function for creating assigner functions.
    var createAssigner = function(keysFunc, undefinedOnly) {
        return function(obj) {
            var length = arguments.length;
            if (length < 2 || obj == null) return obj;
            for (var index = 1; index < length; index++) {
                var source = arguments[index],
                    keys = keysFunc(source),
                    l = keys.length;
                for (var i = 0; i < l; i++) {
                    var key = keys[i];
                    if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
                }
            }
            return obj;
        };
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = createAssigner(_.allKeys);

    // Assigns a given object with all the own properties in the passed-in object(s)
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    _.extendOwn = _.assign = createAssigner(_.keys);

    // Returns the first key on an object that passes a predicate test
    _.findKey = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = _.keys(obj),
            key;
        for (var i = 0, length = keys.length; i < length; i++) {
            key = keys[i];
            if (predicate(obj[key], key, obj)) return key;
        }
    };

    // Internal pick helper function to determine if `obj` has key `key`.
    var keyInObj = function(value, key, obj) {
        return key in obj;
    };

    // Return a copy of the object only containing the whitelisted properties.
    _.pick = restArgs(function(obj, keys) {
        var result = {},
            iteratee = keys[0];
        if (obj == null) return result;
        if (_.isFunction(iteratee)) {
            if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
            keys = _.allKeys(obj);
        } else {
            iteratee = keyInObj;
            keys = flatten(keys, false, false);
            obj = Object(obj);
        }
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            var value = obj[key];
            if (iteratee(value, key, obj)) result[key] = value;
        }
        return result;
    });

    // Return a copy of the object without the blacklisted properties.
    _.omit = restArgs(function(obj, keys) {
        var iteratee = keys[0],
            context;
        if (_.isFunction(iteratee)) {
            iteratee = _.negate(iteratee);
            if (keys.length > 1) context = keys[1];
        } else {
            keys = _.map(flatten(keys, false, false), String);
            iteratee = function(value, key) {
                return !_.contains(keys, key);
            };
        }
        return _.pick(obj, iteratee, context);
    });

    // Fill in a given object with default properties.
    _.defaults = createAssigner(_.allKeys, true);

    // Creates an object that inherits from the given prototype object.
    // If additional properties are provided then they will be added to the
    // created object.
    _.create = function(prototype, props) {
        var result = baseCreate(prototype);
        if (props) _.extendOwn(result, props);
        return result;
    };

    // Create a (shallow-cloned) duplicate of an object.
    _.clone = function(obj) {
        if (!_.isObject(obj)) return obj;
        return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    _.tap = function(obj, interceptor) {
        interceptor(obj);
        return obj;
    };

    // Returns whether an object has a given set of `key:value` pairs.
    _.isMatch = function(object, attrs) {
        var keys = _.keys(attrs),
            length = keys.length;
        if (object == null) return !length;
        var obj = Object(object);
        for (var i = 0; i < length; i++) {
            var key = keys[i];
            if (attrs[key] !== obj[key] || !(key in obj)) return false;
        }
        return true;
    };


    // Internal recursive comparison function for `isEqual`.
    var eq, deepEq;
    eq = function(a, b, aStack, bStack) {
        // Identical objects are equal. `0 === -0`, but they aren't identical.
        // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
        if (a === b) return a !== 0 || 1 / a === 1 / b;
        // A strict comparison is necessary because `null == undefined`.
        if (a == null || b == null) return a === b;
        // `NaN`s are equivalent, but non-reflexive.
        if (a !== a) return b !== b;
        // Exhaust primitive checks
        var type = typeof a;
        if (type !== 'function' && type !== 'object' && typeof b !== 'object') return false;
        return deepEq(a, b, aStack, bStack);
    };

    // Internal recursive comparison function for `isEqual`.
    deepEq = function(a, b, aStack, bStack) {
        // Unwrap any wrapped objects.
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;
        // Compare `[[Class]]` names.
        var className = toString.call(a);
        if (className !== toString.call(b)) return false;
        switch (className) {
            // Strings, numbers, regular expressions, dates, and booleans are compared by value.
            case '[object RegExp]':
                // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
            case '[object String]':
                // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
                // equivalent to `new String("5")`.
                return '' + a === '' + b;
            case '[object Number]':
                // `NaN`s are equivalent, but non-reflexive.
                // Object(NaN) is equivalent to NaN
                if (+a !== +a) return +b !== +b;
                // An `egal` comparison is performed for other numeric values.
                return +a === 0 ? 1 / +a === 1 / b : +a === +b;
            case '[object Date]':
            case '[object Boolean]':
                // Coerce dates and booleans to numeric primitive values. Dates are compared by their
                // millisecond representations. Note that invalid dates with millisecond representations
                // of `NaN` are not equivalent.
                return +a === +b;
        }

        var areArrays = className === '[object Array]';
        if (!areArrays) {
            if (typeof a != 'object' || typeof b != 'object') return false;

            // Objects with different constructors are not equivalent, but `Object`s or `Array`s
            // from different frames are.
            var aCtor = a.constructor,
                bCtor = b.constructor;
            if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                    _.isFunction(bCtor) && bCtor instanceof bCtor) && ('constructor' in a && 'constructor' in b)) {
                return false;
            }
        }
        // Assume equality for cyclic structures. The algorithm for detecting cyclic
        // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

        // Initializing stack of traversed objects.
        // It's done here since we only need them for objects and arrays comparison.
        aStack = aStack || [];
        bStack = bStack || [];
        var length = aStack.length;
        while (length--) {
            // Linear search. Performance is inversely proportional to the number of
            // unique nested structures.
            if (aStack[length] === a) return bStack[length] === b;
        }

        // Add the first object to the stack of traversed objects.
        aStack.push(a);
        bStack.push(b);

        // Recursively compare objects and arrays.
        if (areArrays) {
            // Compare array lengths to determine if a deep comparison is necessary.
            length = a.length;
            if (length !== b.length) return false;
            // Deep compare the contents, ignoring non-numeric properties.
            while (length--) {
                if (!eq(a[length], b[length], aStack, bStack)) return false;
            }
        } else {
            // Deep compare objects.
            var keys = _.keys(a),
                key;
            length = keys.length;
            // Ensure that both objects contain the same number of properties before comparing deep equality.
            if (_.keys(b).length !== length) return false;
            while (length--) {
                // Deep compare each member
                key = keys[length];
                if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
            }
        }
        // Remove the first object from the stack of traversed objects.
        aStack.pop();
        bStack.pop();
        return true;
    };

    // Perform a deep comparison to check if two objects are equal.
    _.isEqual = function(a, b) {
        return eq(a, b);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _.isEmpty = function(obj) {
        if (obj == null) return true;
        if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
        return _.keys(obj).length === 0;
    };

    // Is a given value a DOM element?
    _.isElement = function(obj) {
        return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = nativeIsArray || function(obj) {
        return toString.call(obj) === '[object Array]';
    };

    // Is a given variable an object?
    _.isObject = function(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
    _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
        _['is' + name] = function(obj) {
            return toString.call(obj) === '[object ' + name + ']';
        };
    });

    // Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    if (!_.isArguments(arguments)) {
        _.isArguments = function(obj) {
            return _.has(obj, 'callee');
        };
    }

    // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
    // IE 11 (#1621), and in Safari 8 (#1929).
    if (typeof /./ != 'function' && typeof Int8Array != 'object') {
        _.isFunction = function(obj) {
            return typeof obj == 'function' || false;
        };
    }

    // Is a given object a finite number?
    _.isFinite = function(obj) {
        return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    _.isNaN = function(obj) {
        return _.isNumber(obj) && obj !== +obj;
    };

    // Is a given value a boolean?
    _.isBoolean = function(obj) {
        return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
    };

    // Is a given value equal to null?
    _.isNull = function(obj) {
        return obj === null;
    };

    // Is a given variable undefined?
    _.isUndefined = function(obj) {
        return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _.has = function(obj, key) {
        return obj != null && hasOwnProperty.call(obj, key);
    };

    // Utility Functions
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    _.noConflict = function() {
        root._ = previousUnderscore;
        return this;
    };

    // Keep the identity function around for default iteratees.
    _.identity = function(value) {
        return value;
    };

    // Predicate-generating functions. Often useful outside of Underscore.
    _.constant = function(value) {
        return function() {
            return value;
        };
    };

    _.noop = function() {};

    _.property = property;

    // Generates a function for a given object that returns a given property.
    _.propertyOf = function(obj) {
        return obj == null ? function() {} : function(key) {
            return obj[key];
        };
    };

    // Returns a predicate for checking whether an object has a given set of
    // `key:value` pairs.
    _.matcher = _.matches = function(attrs) {
        attrs = _.extendOwn({}, attrs);
        return function(obj) {
            return _.isMatch(obj, attrs);
        };
    };

    // Run a function **n** times.
    _.times = function(n, iteratee, context) {
        var accum = Array(Math.max(0, n));
        iteratee = optimizeCb(iteratee, context, 1);
        for (var i = 0; i < n; i++) accum[i] = iteratee(i);
        return accum;
    };

    // Return a random integer between min and max (inclusive).
    _.random = function(min, max) {
        if (max == null) {
            max = min;
            min = 0;
        }
        return min + Math.floor(Math.random() * (max - min + 1));
    };

    // A (possibly faster) way to get the current timestamp as an integer.
    _.now = Date.now || function() {
        return new Date().getTime();
    };

    // List of HTML entities for escaping.
    var escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;'
    };
    var unescapeMap = _.invert(escapeMap);

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    var createEscaper = function(map) {
        var escaper = function(match) {
            return map[match];
        };
        // Regexes for identifying a key that needs to be escaped
        var source = '(?:' + _.keys(map).join('|') + ')';
        var testRegexp = RegExp(source);
        var replaceRegexp = RegExp(source, 'g');
        return function(string) {
            string = string == null ? '' : '' + string;
            return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
        };
    };
    _.escape = createEscaper(escapeMap);
    _.unescape = createEscaper(unescapeMap);

    // If the value of the named `property` is a function then invoke it with the
    // `object` as context; otherwise, return it.
    _.result = function(object, prop, fallback) {
        var value = object == null ? void 0 : object[prop];
        if (value === void 0) {
            value = fallback;
        }
        return _.isFunction(value) ? value.call(object) : value;
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter = 0;
    _.uniqueId = function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    };

    // Add a "chain" function. Start chaining a wrapped Underscore object.
    _.chain = function(obj) {
        var instance = _(obj);
        instance._chain = true;
        return instance;
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // Helper function to continue chaining intermediate results.
    var chainResult = function(instance, obj) {
        return instance._chain ? _(obj).chain() : obj;
    };

    // Add your own custom functions to the Underscore object.
    _.mixin = function(obj) {
        _.each(_.functions(obj), function(name) {
            var func = _[name] = obj[name];
            _.prototype[name] = function() {
                var args = [this._wrapped];
                push.apply(args, arguments);
                return chainResult(this, func.apply(_, args));
            };
        });
    };

    // Add all of the Underscore functions to the wrapper object.
    _.mixin(_);

    // Add all mutator Array functions to the wrapper.
    _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            var obj = this._wrapped;
            method.apply(obj, arguments);
            if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
            return chainResult(this, obj);
        };
    });

    // Add all accessor Array functions to the wrapper.
    _.each(['concat', 'join', 'slice'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            return chainResult(this, method.apply(this._wrapped, arguments));
        };
    });

    // Extracts the result from a wrapped and chained object.
    _.prototype.value = function() {
        return this._wrapped;
    };

    // Provide unwrapping proxy for some methods used in engine operations
    // such as arithmetic and JSON stringification.
    _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

    _.prototype.toString = function() {
        return '' + this._wrapped;
    };

    return root._;

});
