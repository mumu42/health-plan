import React, { useState } from 'react';
import { View } from '@tarojs/components';
import { AtAccordion, AtList, AtListItem } from 'taro-ui';
const World: React.FC = () => {
    const [activePanel, setActivePanel] = useState<string>('');

    return (
        <View className="world-container">
            <AtAccordion
                title="组排名"
                open={activePanel === 'group'}
                onClick={() => setActivePanel(activePanel === 'group' ? '' : 'group')}
            >
                <AtList>
                    <AtListItem title="第一名：学习小组" extraText="积分：100" />
                    <AtListItem title="第二名：健身小组" extraText="积分：85" />
                    <AtListItem title="第三名：早起小组" extraText="积分：70" />
                </AtList>
            </AtAccordion>

            <AtAccordion
                title="个人排名"
                open={activePanel === 'personal'}
                onClick={() => setActivePanel(activePanel === 'personal' ? '' : 'personal')}
            >
                <AtList>
                    <AtListItem title="第一名：张三" extraText="积分：120" />
                    <AtListItem title="第二名：李四" extraText="积分：110" />
                    <AtListItem title="第三名：王五" extraText="积分：105" />
                </AtList>
            </AtAccordion>
        </View>
    );
};

export default World;