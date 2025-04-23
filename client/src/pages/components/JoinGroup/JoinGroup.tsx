import React, { useState } from 'react';
import { View, Input, Button, Text } from '@tarojs/components';

const JoinGroup: React.FC = () => {
    // 存储用户输入的组 ID
    const [groupID, setGroupID] = useState<string>('');
    // 存储进组结果信息
    const [joinResult, setJoinResult] = useState<string>('');

    // 处理进组操作
    const handleJoinGroup = () => {
        if (groupID) {
            // 这里可以添加实际的进组逻辑，例如调用 API 接口
            // 为了简单起见，我们模拟进组成功
            setJoinResult(`成功加入组 ID 为 ${groupID} 的组`);
        } else {
            setJoinResult('请输入有效的组 ID');
        }
    };

    return (
        <View className="join-group-container">
            <Text>请输入组 ID：</Text>
            <Input
                type="text"
                value={groupID}
                onChange={(e) => setGroupID(e.target.value)}
                placeholder="输入组 ID"
            />
            <Button onClick={handleJoinGroup}>进组</Button>
            {joinResult && <Text>{joinResult}</Text>}
        </View>
    );
};

export default JoinGroup;