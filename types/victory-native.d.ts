declare module 'victory-native' {
  import { ViewStyle } from 'react-native';

  interface VictoryStyleInterface {
    data?: {
      fill?: string;
      width?: number;
      [key: string]: any;
    };
    labels?: {
      [key: string]: any;
    };
    parent?: ViewStyle;
  }

  interface VictoryAxisCommonProps {
    style?: {
      axis?: {
        stroke?: string;
        [key: string]: any;
      };
      tickLabels?: {
        fill?: string;
        fontSize?: number;
        angle?: number;
        textAnchor?: string;
        padding?: number;
        [key: string]: any;
      };
      ticks?: {
        stroke?: string;
        [key: string]: any;
      };
      grid?: {
        stroke?: string;
        strokeWidth?: number;
        [key: string]: any;
      };
      [key: string]: any;
    };
    tickFormat?: (value: number) => string;
    tickValues?: number[];
    dependentAxis?: boolean;
  }

  interface VictoryChartProps {
    theme?: any;
    height?: number;
    padding?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    domain?: {
      x?: number[];
      y?: number[];
    };
    domainPadding?: {
      x?: number;
      y?: number;
    } | number;
    children?: React.ReactNode;
  }

  interface VictoryBarProps {
    data?: any[];
    x?: string;
    y?: string;
    barRatio?: number;
    style?: VictoryStyleInterface;
    animate?: {
      duration?: number;
      onLoad?: {
        duration?: number;
      };
    };
  }

  export const VictoryTheme: {
    material: any;
  };

  export class VictoryChart extends React.Component<VictoryChartProps> {}
  export class VictoryAxis extends React.Component<VictoryAxisCommonProps> {}
  export class VictoryBar extends React.Component<VictoryBarProps> {}
} 