import React, { useState, useEffect, useCallback } from 'react';
import { View, Button, Text } from '@tarojs/components';
import './CheckIn.scss';
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { checkIn, checkInfoByToday } from '@/api/index'
import Taro from '@tarojs/taro'
import { AtMessage, AtModal, AtModalHeader, AtModalContent } from 'taro-ui'
import CheckInForm from './CheckInForm';

type CheckInProps = {
  onCheckInRequest?: () => void;
};

// 打卡数据类型
export interface CheckInFormData {
  exerciseType: string;
  startTime: string;
  endTime: string;
  notes: string;
}

const CheckIn: React.FC<CheckInProps> = ({ onCheckInRequest }) => {
  const [checkInTime, setCheckInTime] = useState<string>('');
  const [checkInData, setCheckInData] = useState<CheckInFormData>({
          exerciseType: '',
          startTime: '',
          endTime: '',
          notes: '',
        });
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  
  const user = useSelector((state: RootState) => state.user);
  
  // 获取今天的日期字符串
  const getTodayString = useCallback(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  // 检查今日是否已打卡
  const checkTodayStatus = useCallback(() => {
    try {
      const storedDate = Taro.getStorageSync('checkInDate');
      const storedTime = Taro.getStorageSync('checkInTime');
      const storedData = Taro.getStorageSync('checkInData');
      const today = getTodayString();

      if (storedDate === today && storedTime) {
        setIsCheckedIn(true);
        setCheckInTime(storedTime);
        setCheckInData(storedData);
        (!storedData || !storedData.startTime) && user.id && checkInfoByToday(user.id).then(res => {
          const {exerciseType, startTime, endTime, notes} = res.data
          setCheckInData({
            exerciseType,
            startTime,
            endTime,
            notes,
          })
        })
      } else {
        setIsCheckedIn(false);
        setCheckInTime('');
        setCheckInData({
          exerciseType: '',
          startTime: '',
          endTime: '',
          notes: '',
        })
      }
    } catch (error) {
      console.error('检查打卡状态失败:', error);
    }
  }, [getTodayString]);

  useEffect(() => {
    checkTodayStatus();
  }, [checkTodayStatus]);

  // 点击打卡按钮，显示弹窗
  const handleShowModal = () => {
    if (!user.id) {
      onCheckInRequest?.();
      return;
    }
    setShowModal(true);
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handlerDiffTime = () => {
    const day = checkInTime.split(' ')[0] + ' '
    const startTime = new Date(day + checkInData.startTime);
    const endTime = new Date(day + checkInData.endTime);
    const diffTime = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    return `${diffMinutes}分钟`
  }

  // 提交打卡数据
  const handleSubmitCheckIn = async (formData: CheckInFormData) => {
    try {
      setLoading(true);
      
      const response = await checkIn({
        userId: user.id,
        groupId: '',
        status: 'completed',
        ...formData
      });

      if (response.code === 200) {
        const now = new Date();
        const timeString = now.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const dateString = getTodayString();

        // 存储打卡信息
        Taro.setStorageSync('checkInDate', dateString);
        Taro.setStorageSync('checkInTime', timeString);
        Taro.setStorageSync('checkInData', formData); // 存储打卡详情
        
        // 更新状态
        setIsCheckedIn(true);
        setCheckInTime(timeString);
        setShowModal(false);
        setCheckInData({
          ...formData
        })

        // 显示成功消息
        Taro.atMessage({
          message: '打卡成功！',
          type: 'success',
        });
      } else {
        throw new Error(response.message || '打卡失败');
      }
    } catch (error) {
      console.error('打卡失败:', error);
      Taro.atMessage({
        message: error.message || '打卡失败，请重试',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="check-in-container">
      {isCheckedIn ? (
        <View className="check-in-success">
          <Text className="success-text">✅ 今日已打卡</Text>
          <Text className="time-text">打卡时间：{checkInTime}</Text>
          <Text className="time-text">运动类型：{checkInData.exerciseType}</Text>
          <Text className="time-text">开始时间：{checkInData.startTime}</Text>
          <Text className="time-text">结束时间：{checkInData.endTime}</Text>
          {checkInData.notes && <Text className="time-text">备注：{checkInData.notes}</Text>}
          <Text className="time-text">总耗时：{handlerDiffTime()}</Text>
        </View>
      ) : (
        <Button 
          className="check-in-btn"
          onClick={handleShowModal}
        >
          立即打卡
        </Button>
      )}

      {/* 打卡弹窗 */}
      <AtModal
        isOpened={showModal}
        closeOnClickOverlay={false}
        className="check-in-modal"
      >
        <AtModalHeader>运动打卡</AtModalHeader>
        <AtModalContent>
          <CheckInForm
            loading={loading}
            onSubmit={handleSubmitCheckIn}
            onCancel={handleCloseModal}
          />
        </AtModalContent>
      </AtModal>

      <AtMessage />
    </View>
  );
};

export default CheckIn;