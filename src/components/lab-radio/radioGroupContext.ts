import type { InjectionKey, Ref } from 'vue';

/** LabRadioGroup 提供给组内 LabRadio 的共享状态。 */
export interface RadioGroupContext {
  /** 组当前选中的值，由组内被选中的 LabRadio 决定。 */
  selectedValue: Readonly<Ref<string | number | undefined>>;
  /** 选中某个选项；组据此更新自身 v-model。 */
  selectValue: (value: string | number) => void;
  readonly name: string;
  readonly stretch?: boolean;
  readonly size?: 'default' | 'large';
}

export const radioGroupKey: InjectionKey<RadioGroupContext> = Symbol('lab-radio-group');
