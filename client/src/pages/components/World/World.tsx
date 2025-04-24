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
                
            }
        })

        groupRanking().then(res => {
            if (res.code === 200) {
                
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
                            <AtListItem title={i.name} extraText={i.score} />
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
                            <AtListItem title={i.name} extraText={i.score} />
                        )
                    })}
                </AtList>
            </AtAccordion>
        </View>
    );
};

export default World;