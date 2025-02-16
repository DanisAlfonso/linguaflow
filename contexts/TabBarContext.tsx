import React, { createContext, useContext, useState } from 'react';

type TabBarContextType = {
  isTabBarVisible: boolean;
  temporarilyHideTabBar: () => void;
  restoreTabBar: () => void;
};

const TabBarContext = createContext<TabBarContextType | undefined>(undefined);

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const temporarilyHideTabBar = () => {
    setIsTabBarVisible(false);
  };

  const restoreTabBar = () => {
    setIsTabBarVisible(true);
  };

  return (
    <TabBarContext.Provider
      value={{
        isTabBarVisible,
        temporarilyHideTabBar,
        restoreTabBar,
      }}
    >
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  const context = useContext(TabBarContext);
  if (context === undefined) {
    throw new Error('useTabBar must be used within a TabBarProvider');
  }
  return context;
} 