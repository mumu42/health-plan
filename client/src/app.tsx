import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import 'taro-ui/dist/style/index.scss'
import './app.scss'
import { createSelectorQuery } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { Provider } from 'react-redux'
import store from './store'

Taro.createSelectorQuery = createSelectorQuery
function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
  })

  // children 是将要会渲染的页面
  return <Provider store={store}>
    {children}
  </Provider>
}

export default App
