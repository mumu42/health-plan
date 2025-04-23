function setViewport() {
    const doc: HTMLElement = document.documentElement;
    const width: number = doc.getBoundingClientRect().width;
    const dpr: number = window.devicePixelRatio || 1;
  
    if (width < 750) {
      // 移动端
      const scale: number = 1 / dpr;
      const viewportMeta: HTMLMetaElement | null = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content', `width=device-width, initial-scale=${scale}, maximum-scale=${scale}, minimum-scale=${scale}, user-scalable=no`);
      }
    } else {
      // PC 端
      const viewportMeta: HTMLMetaElement | null = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=750, user-scalable=no');
      }
    }
  }
  
  export default setViewport;