declare module 'victory-native' {
  import { ViewStyle } from 'react-native';

  interface VictoryStyleInterface {
    data?: {
      fill?: string | ((props: any) => string);
      width?: number;
      [key: string]: any;
    };
    labels?: {
      fill?: string;
      fontSize?: number;
      [key: string]: any;
    };
    parent?: ViewStyle;
  }

  interface VictoryTooltipProps {
    flyoutStyle?: {
      stroke?: string;
      fill?: string;
      strokeWidth?: number;
      [key: string]: any;
    };
    cornerRadius?: number;
    pointerLength?: number;
    flyoutPadding?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    style?: {
      fill?: string;
      fontSize?: number;
      [key: string]: any;
    };
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
    tickFormat?: ((value: number) => string) | string[];
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

  interface VictoryScatterProps {
    data?: any[];
    x?: string;
    y?: string;
    size?: number;
    style?: VictoryStyleInterface;
    labelComponent?: React.ReactElement;
  }

  export const VictoryTheme: {
    material: any;
  };

  export class VictoryChart extends React.Component<VictoryChartProps> {}
  export class VictoryAxis extends React.Component<VictoryAxisCommonProps> {}
  export class VictoryBar extends React.Component<VictoryBarProps> {}
  export class VictoryScatter extends React.Component<VictoryScatterProps> {}
  export class VictoryTooltip extends React.Component<VictoryTooltipProps> {}
} 