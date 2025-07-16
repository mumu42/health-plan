import React, { useState, useEffect } from 'react';
import { View } from '@tarojs/components';
import { AtAccordion, AtList, AtListItem } from 'taro-ui';
import { userRanking, groupRanking } from '@/api/index'

const World: React.FC = () => {
    const [activePanel, setActivePanel] = useState<string>('');
    const [userRankingList, setUserRankingList] = useState<any[]>([]);
    const [groupRankingList, setGroupRankingList] = useState<any[]>([]);
    useEffect(() => {
      userRanking().then(res => {
            if (res.code === 200) {
              setUserRankingList(res.data)
            }
        })

      groupRanking().then(res => {
            if (res.code === 200) {
              setGroupRankingList(res.data)
            }
        })
    }, [])
    return (
        <View className="world-container">
            <AtAccordion
                title="组排名"
                open={activePanel === 'group'}
                onClick={() => setActivePanel(activePanel === 'group' ? '' : 'group')}
                >
                <AtList>
                    {groupRankingList.map(i => {
                        return (
                          <AtListItem key={ i.name } title={i.name} extraText={'总打卡：' + i.checkInCount} />
                        )
                    })}
                    {groupRankingList.length === 0 ?
                      <View className='at-article__p'>
                        还未有人创建组群，快去邀请的小伙伴一起创建组群打卡吧！
                      </View> : <></>}
                </AtList>
            </AtAccordion>

            <AtAccordion
                title="个人排名"
                open={activePanel === 'personal'}
                onClick={() => setActivePanel(activePanel === 'personal' ? '' : 'personal')}
            >
                <AtList>
                    {userRankingList.map(i => {
                        return (
                          <AtListItem key={i.nickname} title={i.nickname} extraText={'打卡次数：' + i.checkInCount} />
                        )
                    })}
                    {userRankingList.length === 0 ?
                      <View className='at-article__p'>
                        还未有人打卡，快去打卡吧！
                      </View> : <></>}
                </AtList>
            </AtAccordion>
        </View>
    );
};

export default World;