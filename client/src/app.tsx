import React, { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import 'taro-ui/dist/style/index.scss'
import './app.scss'
import './styles/mobile-responsive.scss'
import './styles/taro-ui-custom.scss'
import { createSelectorQuery } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { Provider } from 'react-redux'
import store from './store'

Taro.createSelectorQuery = createSelectorQuery

// 动态设置根字体大小
const setRem = () => {
  const designWidth = 750; // 设计稿宽度
  const systemInfo = Taro.getSystemInfoSync();
  const scale = systemInfo.windowWidth / designWidth;
  const baseFontSize = 100 * scale;
  
  // 使用Taro的方式设置样式
  const style = `
    :root {
      fontSize: ${baseFontSize}px !important;
    }
  `;
  
  // 创建样式节点
  const styleNode = document.createElement('style');
  styleNode.innerHTML = style;
  document.head.appendChild(styleNode);
};

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.');
    setRem();
    
    // 监听屏幕旋转
    Taro.onWindowResize(() => {
      setRem();
    });
  });

  // children 是将要会渲染的页面
  return <Provider store={store}>
    <div className="mobile-optimized">
      {children}
    </div>
  </Provider>
}

export default App
