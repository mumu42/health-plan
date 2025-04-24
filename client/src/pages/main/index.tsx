import { useState } from 'react'
import { AtTabs, AtTabsPane } from 'taro-ui'
import { View } from '@tarojs/components'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import CheckIn from '../components/CheckIn/CheckIn'
import CreateGroup from '../components/CreateGroup/CreateGroup'
import JoinGroup from '../components/JoinGroup/JoinGroup'
import World from '../components/World/World'
import LoginCmp from '../components/LoginCmp/LoginCmp'
import './index.scss'

const tabs = [
  { label: '打卡', key: 'check-in' },
  { label: '创组', key: 'create-group' },
  { label: '世界', key: 'world' },
]

const Index = () => {
  const [activeTab, setActiveTab] = useState('create-group')
  
  // 正确使用useSelector
  const user = useSelector((state: RootState) => state.user)

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(!user.name)

  const handleTabChange = (index: number) => {
    const tabKey = tabs[index].key
    setActiveTab(tabKey)
  }

  const closeLoginModal = () => setIsLoginModalOpen(false)
  const openLoginModal = () => {
    console.log('user=', user)
    setIsLoginModalOpen(true)
  }

  const currentTabIndex = tabs.findIndex(t => t.key === activeTab)
  const tabList = tabs.map(tab => ({ title: tab.label }))

  return (
    <View className='index'>
      <AtTabs
        current={currentTabIndex}
        tabList={tabList}
        onClick={handleTabChange}
      >
        <AtTabsPane current={currentTabIndex} index={0}>
          <CheckIn onCheckInRequest={openLoginModal}/>
        </AtTabsPane>
        <AtTabsPane current={currentTabIndex} index={1}>
          <CreateGroup onAuthRequired={openLoginModal}/>
        </AtTabsPane>
        <AtTabsPane current={currentTabIndex} index={2}>
          <World />
        </AtTabsPane>
      </AtTabs>

      <LoginCmp isOpen={isLoginModalOpen} onClose={closeLoginModal} />
    </View>
  )
}

export default Index
