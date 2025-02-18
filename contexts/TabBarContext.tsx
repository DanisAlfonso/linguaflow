import React, { createContext, useContext, useState, useCallback } from 'react';

type TabBarContextType = {
  isTabBarVisible: boolean;
  temporarilyHideTabBar: () => void;
  restoreTabBar: () => void;
};

const TabBarContext = createContext<TabBarContextType | undefined>(undefined);

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const temporarilyHideTabBar = useCallback(() => {
    console.log('TabBarContext - Hiding tab bar');
    setIsTabBarVisible(false);
  }, []);

  const restoreTabBar = useCallback(() => {
    console.log('TabBarContext - Restoring tab bar');
    setIsTabBarVisible(true);
  }, []);

  console.log('TabBarContext - Current visibility:', isTabBarVisible);

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