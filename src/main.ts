import { createApp } from 'vue'
import './style.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

/**
 * 用户 => 1: ?appkey=82hegw5u86cjx&token=FvECp9COrmOKdB0p/v+W4XBDPw4qetuW@bxm9.cn.rongnav.com;bxm9.cn.rongcfg.com
 * 用户 => 2: ?appkey=82hegw5u86cjx&token=Bp376CBXkAqKdB0p/v+W4QzBmGay9sRR@bxm9.cn.rongnav.com;bxm9.cn.rongcfg.com
 * 用户 => 3: ?appkey=82hegw5u86cjx&token=dB2KuQAYe/6KdB0p/v+W4Wew8gTldN03@bxm9.cn.rongnav.com;bxm9.cn.rongcfg.com
 */

try {
  const search = location.href.split('?')
  const qarams: URLSearchParams = new URLSearchParams(search[1])
  /*⚠️ ⚠️ ⚠️ ⚠️ ⚠️ -- 第三方集成区域 -- ⚠️ ⚠️ ⚠️ ⚠️ */
  // ⚠️ 注意替换为自己的AppKey （以下是测试appkey）⚠️
  const APPKEY = qarams.get('appkey');

  // 业务数据扩展接口, 如果字符串有空格需要替换成 ‘+’
  const TOKEN: string | undefined = qarams.get('token')?.split(' ').join('+');
  // 适配吕布环境，无动态导航，需要传递 navi
  const NAVI = qarams.get('navi');
  (window as any).APPKEY = APPKEY;
  (window as any).TOKEN = TOKEN;
  (window as any).NAVI = NAVI;
} catch (err) {
  console.log(err)
}


createApp(App).use(ElementPlus).mount('#app')
