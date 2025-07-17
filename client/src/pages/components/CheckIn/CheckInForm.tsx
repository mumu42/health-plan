import React, { useState } from 'react';
import { View, Button, Text, Picker } from '@tarojs/components';
import { 
  AtList, 
  AtListItem, 
  AtTextarea,
  AtActionSheet,
  AtActionSheetItem,
} from 'taro-ui';
import { CheckInFormData } from './CheckIn';
import './CheckIn.scss';

interface CheckInFormProps {
  loading: boolean;
  onSubmit: (data: CheckInFormData) => void;
  onCancel: () => void;
}

// 运动类型选项
const EXERCISE_TYPES = [
  { label: '跑步', value: 'running' },
  { label: '健走', value: 'walking' },
  { label: '骑行', value: 'cycling' },
  { label: '游泳', value: 'swimming' },
  { label: '健身房', value: 'gym' },
  { label: '瑜伽', value: 'yoga' },
  { label: '篮球', value: 'basketball' },
  { label: '足球', value: 'football' },
  { label: '羽毛球', value: 'badminton' },
  { label: '乒乓球', value: 'ping-pong' },
  { label: '网球', value: 'tennis' },
  { label: '射击', value: 'shooting' },
  { label: '棒球', value: 'baseball' },
  { label: '保龄球', value: 'bowling' },
  { label: '滑板', value: 'skating' },
  { label: '高尔夫', value: 'golf' },
  { label: '太极', value: 'taichi' },
  { label: '跳绳', value: 'jump-rope' },
  { label: '拳击', value: 'boxing' },
  { label: '其他', value: 'other' }
];

const CheckInForm: React.FC<CheckInFormProps> = ({ loading, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<CheckInFormData>({
    exerciseType: '',
    startTime: '',
    endTime: '',
    notes: ''
  });
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [errors, setErrors] = useState<Partial<CheckInFormData>>({});
  const [selector] = useState(EXERCISE_TYPES.map(i => i.label))
  // 选择运动类型
  const handleSelectExerciseType = (type: { label: string, value: string }) => {
    setFormData(prev => ({ ...prev, exerciseType: type.label }));
    setShowActionSheet(false);
    // 清除错误信息
    if (errors.exerciseType) {
      setErrors(prev => ({ ...prev, exerciseType: '' }));
    }
  };

  // 选择时间
  const handleTimeChange = (type: 'startTime' | 'endTime', val: String) => {
    setFormData(prev => ({ ...prev, [type]: val }));

    if (errors[type]) {
      setErrors(prev => ({ ...prev, [type]: '' }));
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Partial<CheckInFormData> = {};
    
    if (!formData.exerciseType) {
      newErrors.exerciseType = '请选择运动类型';
    }
    if (!formData.startTime) {
      newErrors.startTime = '请填写开始时间';
    }
    if (!formData.endTime) {
      newErrors.endTime = '请填写结束时间';
    }

    // 验证时间格式和逻辑
    if (formData.startTime && formData.endTime) {
      const day = new Date()
      const y = day.getFullYear()
      const m = day.getMonth() + 1
      const d = day.getDate()

      const start = new Date(`${y}/${m}/${d} ${formData.startTime}`);
      const end = new Date(`${y}/${m}/${d} ${formData.endTime}`);
      if (start >= end) {
        newErrors.endTime = '结束时间必须晚于开始时间';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const onTimeChange = (e) => {
    handleTimeChange('startTime', e.detail.value)
  }

  const onEndTimeChange = (e) => {
    handleTimeChange('endTime', e.detail.value)
  }

  const onTypeChange = (e) => {
    const val = e.detail.value
    const type = EXERCISE_TYPES[val]
    if (!type.label) {
        return
    }
    handleSelectExerciseType(type)
  }

  return (
    <View className="check-in-form">
        {/* 运动类型选择 */}
        <View className='form-item'>
            <Text className='label'>类型</Text>
            <View className='form-item-content'>
              <Picker mode='selector' range={selector} onChange={onTypeChange}>
                <AtList>
                  <AtListItem title={formData.exerciseType || '请选择运动类型'}/>
                </AtList>
              </Picker>
            </View>
        </View>
        {errors.exerciseType && (
          <Text className="error-text">{errors.exerciseType}</Text>
        )}

        {/* 开始时间 */}
        <View className='form-item'>
            <Text className='label'>开始时间</Text>
            <View className='form-item-content'>
              <Picker mode='time' onChange={onTimeChange}>
                <AtList>
                  <AtListItem title={formData.startTime || '请选择时间'} />
                </AtList>
              </Picker>
            </View>
        </View>

        {errors.startTime && (
          <Text className="error-text">{errors.startTime}</Text>
        )}
        {/* 结束时间 */}
        <View className='form-item'>
            <Text className='label'>结束时间</Text>
            <View className='form-item-content'>
              <Picker mode='time' onChange={onEndTimeChange}>
                <AtList>
                  <AtListItem title={formData.endTime || '请选择时间'} />
                </AtList>
              </Picker>
            </View>
        </View>
        {errors.endTime && (
          <Text className="error-text">{errors.endTime}</Text>
        )}

        {/* 备注 */}
        <View className="form-item">
          <AtTextarea
            value={formData.notes}
            onChange={(value) => setFormData(prev => ({ ...prev, notes: String(value) }))}
            placeholder="请输入运动备注（可选）"
            maxLength={200}
            className="notes-textarea"
          />
        </View>

      {/* 按钮区域 */}
      <View className="form-buttons">
        <Button 
          className="cancel-btn"
          onClick={onCancel}
          disabled={loading}
        >
          取消
        </Button>
        <Button 
          className="submit-btn"
          onClick={handleSubmit}
          loading={loading}
          disabled={loading}
        >
          {loading ? '打卡中...' : '立即打卡'}
        </Button>
      </View>

      {/* 运动类型选择器 */}
      <AtActionSheet
        isOpened={showActionSheet}
        cancelText="取消"
        onCancel={() => setShowActionSheet(false)}
        onClose={() => setShowActionSheet(false)}
      >
        {EXERCISE_TYPES.map(type => (
          <AtActionSheetItem
            key={type.value}
            onClick={() => handleSelectExerciseType(type)}
          >
            {type.label}
          </AtActionSheetItem>
        ))}
      </AtActionSheet>
    </View>
  );
};

export default CheckInForm;