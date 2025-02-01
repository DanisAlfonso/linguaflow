import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

type GridProps = {
  children: React.ReactNode;
  columns?: number;
  spacing?: number;
  style?: any;
};

export function Grid({ children, columns = 1, spacing = 20, style }: GridProps) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  
  // Responsive columns based on screen width
  let responsiveColumns = columns;
  if (isWeb) {
    if (width < 600) responsiveColumns = 1;
    else if (width < 960) responsiveColumns = Math.min(2, columns);
    else if (width < 1280) responsiveColumns = Math.min(3, columns);
  }

  const childrenArray = React.Children.toArray(children);
  const rows = [];
  
  for (let i = 0; i < childrenArray.length; i += responsiveColumns) {
    const row = childrenArray.slice(i, i + responsiveColumns);
    rows.push(row);
  }

  return (
    <View style={[styles.container, style]}>
      {rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[
            styles.row,
            { marginBottom: rowIndex < rows.length - 1 ? spacing : 0 },
          ]}
        >
          {row.map((child, index) => (
            <View
              key={index}
              style={[
                styles.column,
                {
                  width: `${100 / responsiveColumns}%`,
                  paddingHorizontal: spacing / 2,
                },
              ]}
            >
              {child}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -10,
  },
  column: {
    flex: 1,
  },
}); 