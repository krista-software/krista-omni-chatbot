export const constants = {
  footerHeight: 90,
  footerHeightWithoutSendMessage: 28,
  headerHeight: 70,
  drawerWidth: 350,
  sidebarDrawerWidth: 400,

  getFooterHeight(hideSendMessage?: boolean) {
    return hideSendMessage ? this.footerHeightWithoutSendMessage : this.footerHeight;
  }
};
