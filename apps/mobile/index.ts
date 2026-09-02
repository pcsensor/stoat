import { registerRootComponent } from 'expo';
import { Component, createElement, type ErrorInfo, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

import App from './App';

// 全局未捕获异常拦截：防止第三方库或异步定时器在后台/锁屏解封时因网络异常直接杀死 App 进程
if (typeof globalThis !== 'undefined') {
  const g = globalThis as any;
  if (g.ErrorUtils) {
    const originalHandler = g.ErrorUtils.getGlobalHandler?.();
    g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      console.warn('[Global Error Intercepted]', error, 'isFatal:', isFatal);
      const str = String(error?.message || error || '');
      // 常见锁屏/断网相关的无害异常一律静默兜底，杜绝闪退
      if (
        str.includes('Socket') ||
        str.includes('WebSocket') ||
        str.includes('network') ||
        str.includes('Network') ||
        str.includes('signal stream') ||
        str.includes("Unhandled 'error'") ||
        str.includes('Connection') ||
        str.includes('EPIPE') ||
        str.includes('ECONNRESET') ||
        str.includes('ECONNREFUSED')
      ) {
        return;
      }
      if (originalHandler) {
        originalHandler(error, false);
      }
    });
  }
}

// React 组件树全局容灾 Boundary
class GlobalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorText: string }> {
  state = { hasError: false, errorText: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorText: error?.message || '未知异常' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[GlobalErrorBoundary caught]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return createElement(
        View,
        { style: errorStyles.container },
        createElement(Text, { style: errorStyles.title }, 'Radio 遇到临时渲染异常'),
        createElement(Text, { style: errorStyles.subtitle }, this.state.errorText)
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { color: '#FF4D4D', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#E0E0E0', fontSize: 14, textAlign: 'center' },
});

function Root() {
  return createElement(
    GlobalErrorBoundary,
    null,
    createElement(SafeAreaProvider, { style: { flex: 1 } }, createElement(App))
  );
}

registerRootComponent(Root);
