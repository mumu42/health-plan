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
          console.error('res=', res)
            if (res.code === 200) {
              setUserRankingList(res.data)
            }
        })

      groupRanking().then(res => {
        console.error('groupRanking=', res)
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
                </AtList>
            </AtAccordion>
        </View>
    );
};

export default World;