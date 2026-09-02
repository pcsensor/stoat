/**
 * @vladfrangu/async_event_emitter 的 RN shim。
 *
 * 原因：该包把 node-inspect-extracted 内联进 dist，并在模块顶层执行
 * `require_inspect()` + 解构，在 RN/Metro 环境初始化即抛
 * "TypeError: target is not an object"，导致 stoat.js 无法加载。
 *
 * stoat.js 实际只用到构造器、on、emit（同步调用，不 await 返回值）。
 * 这里实现同名 API 的最小 EventEmitter，行为对齐常见用法。
 */
"use strict";

class AsyncEventEmitter {
  #handlers = new Map();

  on(event, listener) {
    this.#add(event, listener, false);
    return this;
  }

  once(event, listener) {
    this.#add(event, listener, true);
    return this;
  }

  off(event, listener) {
    return this.removeListener(event, listener);
  }

  removeListener(event, listener) {
    const list = this.#handlers.get(event);
    if (list) {
      const idx = list.findIndex((h) => h.listener === listener || h.listener.listener === listener);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) this.#handlers.delete(event);
    }
    return this;
  }

  removeAllListeners(event) {
    if (event === undefined) this.#handlers.clear();
    else this.#handlers.delete(event);
    return this;
  }

  listenerCount(event) {
    return this.#handlers.get(event)?.length ?? 0;
  }

  emit(event, ...args) {
    const list = this.#handlers.get(event);
    if (!list || list.length === 0) return Promise.resolve(true);
    // 快照迭代：允许监听器在派发过程中增删
    for (const h of [...list]) {
      if (h.once) this.removeListener(event, h.listener);
      try {
        h.listener(...args);
      } catch (e) {
        // 对齐 EventEmitter 语义：error 事件无监听时抛出，其余打日志
        if (event === "error") throw e;
        console.error(`AsyncEventEmitter: listener for "${String(event)}" threw`, e);
      }
    }
    return Promise.resolve(true);
  }

  emitSerial(event, ...args) {
    return Promise.resolve(this.emit(event, ...args));
  }

  #add(event, listener, once) {
    if (typeof listener !== "function") {
      throw new TypeError("The listener argument must be a function.");
    }
    let list = this.#handlers.get(event);
    if (!list) {
      list = [];
      this.#handlers.set(event, list);
    }
    list.push({ listener, once });
  }
}

module.exports = { AsyncEventEmitter };
