/**
 * 浏览器兼容性补丁文件
 * 为旧版本浏览器提供必要的功能支持
 */

// Promise polyfill (IE不支持Promise)
if (typeof Promise === 'undefined') {
    // 简单的Promise polyfill实现
    window.Promise = function(executor) {
        var self = this;
        self.state = 'pending';
        self.value = undefined;
        self.handlers = [];

        function resolve(result) {
            if (self.state === 'pending') {
                self.state = 'fulfilled';
                self.value = result;
                self.handlers.forEach(handle);
            }
        }

        function reject(error) {
            if (self.state === 'pending') {
                self.state = 'rejected';
                self.value = error;
                self.handlers.forEach(handle);
            }
        }

        function handle(handler) {
            if (self.state === 'pending') {
                self.handlers.push(handler);
            } else {
                if (self.state === 'fulfilled' && handler.onFulfilled) {
                    handler.onFulfilled(self.value);
                }
                if (self.state === 'rejected' && handler.onRejected) {
                    handler.onRejected(self.value);
                }
            }
        }

        this.then = function(onFulfilled, onRejected) {
            return new Promise(function(resolve, reject) {
                handle({
                    onFulfilled: function(result) {
                        try {
                            resolve(onFulfilled ? onFulfilled(result) : result);
                        } catch (ex) {
                            reject(ex);
                        }
                    },
                    onRejected: function(error) {
                        try {
                            resolve(onRejected ? onRejected(error) : error);
                        } catch (ex) {
                            reject(ex);
                        }
                    }
                });
            });
        };

        this.catch = function(onRejected) {
            return this.then(null, onRejected);
        };

        try {
            executor(resolve, reject);
        } catch (ex) {
            reject(ex);
        }
    };
}

// Array.includes polyfill
if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex) {
        'use strict';
        if (this == null) {
            throw new TypeError('Array.prototype.includes called on null or undefined');
        }

        var O = Object(this);
        var len = parseInt(O.length) || 0;
        if (len === 0) {
            return false;
        }
        var n = parseInt(fromIndex) || 0;
        var k;
        if (n >= 0) {
            k = n;
        } else {
            k = len + n;
            if (k < 0) {
                k = 0;
            }
        }
        for (; k < len; k++) {
            if (O[k] === searchElement) {
                return true;
            }
        }
        return false;
    };
}

// Object.assign polyfill
if (typeof Object.assign != 'function') {
    Object.assign = function(target) {
        'use strict';
        if (target == null) {
            throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource != null) {
                for (var nextKey in nextSource) {
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}

// fetch polyfill (基础版本)
if (typeof fetch === 'undefined') {
    window.fetch = function(url, options) {
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            options = options || {};
            
            xhr.open(options.method || 'GET', url);
            
            if (options.headers) {
                for (var key in options.headers) {
                    xhr.setRequestHeader(key, options.headers[key]);
                }
            }
            
            xhr.onload = function() {
                resolve({
                    ok: xhr.status >= 200 && xhr.status < 300,
                    status: xhr.status,
                    statusText: xhr.statusText,
                    text: function() {
                        return Promise.resolve(xhr.responseText);
                    },
                    json: function() {
                        try {
                            return Promise.resolve(JSON.parse(xhr.responseText));
                        } catch (e) {
                            return Promise.reject(e);
                        }
                    }
                });
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error'));
            };
            
            xhr.send(options.body);
        });
    };
}

// 检查ES6 Class支持
try {
    eval('class TestClass {}');
} catch (e) {
    // 如果不支持class语法，显示错误信息
    document.addEventListener('DOMContentLoaded', function() {
        var errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f8d7da;color:#721c24;padding:15px;z-index:9999;text-align:center;font-family:Arial,sans-serif;';
        errorDiv.innerHTML = 'Your browser version is too old and doesn\'t support ES6 syntax. Please upgrade to a newer browser.';
        document.body.insertBefore(errorDiv, document.body.firstChild);
    });
}

console.log('Polyfills loaded successfully'); 