import React from 'react';
import { Platform } from 'react-native';
import {
  VictoryAxis as WebVictoryAxis,
  VictoryBar as WebVictoryBar,
  VictoryChart as WebVictoryChart,
  VictoryLine as WebVictoryLine,
  VictoryScatter as WebVictoryScatter,
  VictoryTooltip as WebVictoryTooltip,
  VictoryPie as WebVictoryPie,
  VictoryLabel as WebVictoryLabel,
} from 'victory';
import { CartesianChart } from 'victory-native';

type ChartProps = {
  children?: React.ReactNode;
  [key: string]: any;
};

// Create wrapper components for native platform
const NativeVictoryChart: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart {...props}>{children}</CartesianChart>
);

const NativeVictoryAxis: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart.Axis {...props}>{children}</CartesianChart.Axis>
);

const NativeVictoryBar: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart.Bar {...props}>{children}</CartesianChart.Bar>
);

const NativeVictoryLine: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart.Line {...props}>{children}</CartesianChart.Line>
);

const NativeVictoryScatter: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart.Point {...props}>{children}</CartesianChart.Point>
);

const NativeVictoryTooltip: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart.Tooltip {...props}>{children}</CartesianChart.Tooltip>
);

const NativeVictoryPie: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart.Pie {...props}>{children}</CartesianChart.Pie>
);

const NativeVictoryLabel: React.FC<ChartProps> = ({ children, ...props }) => (
  <CartesianChart.Label {...props}>{children}</CartesianChart.Label>
);

export const VictoryAxis = Platform.select({
  web: WebVictoryAxis,
  default: NativeVictoryAxis,
});

export const VictoryBar = Platform.select({
  web: WebVictoryBar,
  default: NativeVictoryBar,
});

export const VictoryChart = Platform.select({
  web: WebVictoryChart,
  default: NativeVictoryChart,
});

export const VictoryLine = Platform.select({
  web: WebVictoryLine,
  default: NativeVictoryLine,
});

export const VictoryScatter = Platform.select({
  web: WebVictoryScatter,
  default: NativeVictoryScatter,
});

export const VictoryTooltip = Platform.select({
  web: WebVictoryTooltip,
  default: NativeVictoryTooltip,
});

export const VictoryPie = Platform.select({
  web: WebVictoryPie,
  default: NativeVictoryPie,
});

export const VictoryLabel = Platform.select({
  web: WebVictoryLabel,
  default: NativeVictoryLabel,
}); 