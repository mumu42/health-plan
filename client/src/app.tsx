import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import 'taro-ui/dist/style/index.scss'
import './app.scss'
import { createSelectorQuery } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { Provider } from 'react-redux'
import store from './store'

Taro.createSelectorQuery = createSelectorQuery

// 动态设置根字体大小
const setRem = () => {
  const designWidth = 750; // 设计稿宽度
  const scale = Taro.getSystemInfoSync().windowWidth / designWidth;
  const baseFontSize = 100 * scale;
  const htmlStyle = `html{font-size: ${baseFontSize}px !important;}`;
  const styleElement = document.createElement('style');
  styleElement.innerHTML = htmlStyle;
  document.head.appendChild(styleElement);
};

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.');
    setRem();
    window.addEventListener('resize', setRem);
  });

  // children 是将要会渲染的页面
  return <Provider store={store}>
    {children}
  </Provider>
}

export default App
