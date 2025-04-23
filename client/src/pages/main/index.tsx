// 在文件顶部添加AtTabs引入
import { AtTabs, AtTabsPane } from 'taro-ui';
import { Component, PropsWithChildren } from 'react';
import { View } from '@tarojs/components';
import CheckIn from '../components/CheckIn/CheckIn';
import CreateGroup from '../components/CreateGroup/CreateGroup';
import JoinGroup from '../components/JoinGroup/JoinGroup';
import World from '../components/World/World';
import LoginCmp from '../components/LoginCmp/LoginCmp';
import './index.scss';

// #region 书写注意
//
// 目前 typescript 版本还无法在装饰器模式下将 Props 注入到 Taro.Component 中的 props 属性
// 需要显示声明 connect 的参数类型并通过 interface 的方式指定 Taro.Component 子类的 props
// 这样才能完成类型检查和 IDE 的自动提示
// 使用函数模式则无此限制
// ref: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20796
//
// #endregion

type PageStateProps = {
  counter: {
    num: number
  }
}

type PageDispatchProps = {
  add: () => void
  dec: () => void
  asyncAdd: () => any
}

type PageOwnProps = {}

type PageState = {}

type IProps = PageStateProps & PageDispatchProps & PageOwnProps

interface Index {
  props: IProps;
}

// 在render方法中添加tabs定义
const tabs = [
  { label: '打卡', key: 'check-in' },
  { label: '创组', key: 'create-group' },
  { label: '世界', key: 'world' },
];

class Index extends Component<PropsWithChildren> {
  state = {
    activeTab: 'create-group',
    isLoginModalOpen: true
  };

  

  // 修改handleTabChange方法
  handleTabChange = (index: number) => {
    const tabKey = tabs[index].key;
    this.setState({ activeTab: tabKey });
  };

  closeLoginModal = () => {
    this.setState({ isLoginModalOpen: false });
  };

  openLoginModal = () => {
    console.log('openLoginModal');
    this.setState({ isLoginModalOpen: true });
  };

  render() {
    const { activeTab, isLoginModalOpen } = this.state;
    const tabList = [
      { title: '打卡' },
      { title: '创组' },
      { title: '世界' }
    ];

    // 修改currentTabIndex计算方式
    const currentTabIndex = tabs.findIndex(t => t.key === activeTab);

    return (
      <View className='index'>
        <AtTabs
          current={currentTabIndex}
          tabList={tabList}
          onClick={this.handleTabChange}
        >
          <AtTabsPane current={currentTabIndex} index={0}>
            <CheckIn onCheckInRequest={this.openLoginModal}/>
          </AtTabsPane>
          <AtTabsPane current={currentTabIndex} index={1}>
            <CreateGroup onAuthRequired={this.openLoginModal}/>
          </AtTabsPane>
          <AtTabsPane current={currentTabIndex} index={2}>
            <World />
          </AtTabsPane>
        </AtTabs>

        <LoginCmp isOpen={isLoginModalOpen} onClose={this.closeLoginModal} />
      </View>
    );
  }
}

export default Index;
