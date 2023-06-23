<script setup lang="ts">
// import HelloWorld from './components/HelloWorld.vue'
import { onBeforeMount, ref, nextTick } from 'vue'
import { PictureFilled, Promotion } from '@element-plus/icons-vue'
import { ElNotification, ElLoading, ElScrollbar } from 'element-plus'
import { 
  Events,
  ErrorCode,
  IAReceivedMessage,
  IMessagesEvent,
  IConversationEvent,
  IChatroomListenerData,
  IAReceivedConversation,
  IConversationOption,
  GetHistoryMessageOption,
  GetHistoryMessageResult,

  init,
  addEventListener,
  connect,
  getConversationList,
  clearMessagesUnreadStatus,
  sendSyncReadStatusMessage,
  getHistoryMessages,
  sendMessage,
  TextMessage,
} from '@rongcloud/imlib-next'

const activeIndex = ref('1');
const textarea = ref();
const pullOfflineMessageFinished = ref<boolean>(false);
let loading: any;

const handleSelect = (key: string, keyPath: string[]) => {
  console.log(key, keyPath)
}

const cardCss = {
  padding: '10px',
  height: 'calc(100% - 79px)'
}

// 本地 UI 会话渲染数据
const localConversationList = ref<IAReceivedConversation[]>()
// 当前选中的会话数据
const currentConversation = ref<IAReceivedConversation>()
// 本地 UI 历史消息渲染数据
const localMessageList = ref<IAReceivedMessage[]>()


onBeforeMount(async () => {
  /**
   * IMLib 初始化
   */
  init({ appkey: (window as any).APPKEY });
  /**
   * IMLib 设置监听
   */
  addEventListener(Events.CONNECTED, () => {
    
  })
  addEventListener(Events.MESSAGES, (evt: IMessagesEvent) => {
    console.log('IAReceivedMessage', evt)
  })
  addEventListener(Events.CONVERSATION, (evt: IConversationEvent) => {
    console.log('IConversationEvent', evt)
    // 等待离线消息拉取完成
    if (!pullOfflineMessageFinished) {
      return
    }
    evt.conversationList.forEach((item) => {
      const index: number = localConversationList.value!.findIndex((con) => {
        return con.targetId === item.conversation.targetId && con.conversationType === item.conversation.conversationType && con.channelId === item.conversation.channelId
      })
      if (index < 0) {
        localConversationList.value?.push(item.conversation)
        return
      }
      localConversationList.value![index] = item.conversation
    })

  })
  addEventListener(Events.CHATROOM, (evt: IChatroomListenerData) => {
    console.log('IChatroomListenerData', evt)
  })
  addEventListener(Events.PULL_OFFLINE_MESSAGE_FINISHED, async () => {
    pullOfflineMessageFinished.value = true;
    // 关闭遮罩层
    loading.close();
    const { code, data } = await getConversationListHandle()
    if (code !== ErrorCode.SUCCESS){
      ElNotification({
        title: 'Error',
        message: `get conversation list error, code : ${ code }`,
        type: 'error',
      })
      return
    }
    localConversationList.value = data;
  })
  /**
   * IMLib 连接
   */
  const { code, data } = await connect((window as any).TOKEN)
  if ( code === ErrorCode.SUCCESS) {
    ElNotification({
      title: 'Success',
      message: `Connect success, UserId : ${ data?.userId }`,
      type: 'success',
    })
    loading = ElLoading.service({
      lock: true,
      text: 'Loading',
      background: 'rgba(0, 0, 0, 0.7)',
    })
  }
})
const rongMessageListRef = ref<HTMLDivElement>()
const rongMessageBoxRef = ref<HTMLDivElement>()
const scrollbarRef = ref<InstanceType<typeof ElScrollbar>>()

const scroll = (data: any) => {
  console.log('data', data, rongMessageBoxRef.value?.clientHeight, rongMessageListRef.value?.clientHeight)
}

/**
 * IMLib 获取会话列表
 */
const getConversationListHandle = (count?: number, startTime?: number,) => {
  return getConversationList({ count, startTime });
}

const selectConversation = async (con: IAReceivedConversation) => {
  currentConversation.value = con;
  const conversationType = con.conversationType;
  const targetId = con.targetId;
  // 多端未读数同步
  const { code } = await clearMessagesUnreadStatus({ conversationType, targetId });
  if (code !== ErrorCode.SUCCESS) {
    return
  }
  sendSyncReadStatusMessage({ conversationType, targetId }, Date.now())
  const { code: code1, data } = await getHistoryMessagesHandle({ conversationType, targetId })
  if (code1 !== ErrorCode.SUCCESS) {
    return
  }
  console.log('localMessageList', data)
  localMessageList.value = data?.list
  await nextTick()
  const height = rongMessageListRef.value!.clientHeight - rongMessageBoxRef.value!.clientHeight + 9.5
  scrollbarRef.value?.setScrollTop(height);
}

/**
 * IMLib 获取历史消息
 */
const getHistoryMessagesHandle = async (conversation: IConversationOption, option?: GetHistoryMessageOption) => {
  return getHistoryMessages(conversation, option)
}

/**
 * IMLib 发送消息
 */
const sendMessageHandle = async () => {
  const conversationType = currentConversation.value!.conversationType;
  const targetId = currentConversation.value!.targetId;
  const message = new TextMessage({ content: textarea.value });
  const { code, data } = await sendMessage({ conversationType, targetId }, message);
  if (code !== 0) {
    ElNotification({
      title: 'Error',
      message: `send message error, code : ${ code }`,
      type: 'error',
    })
    return
  }
  localMessageList.value?.push(data!);
  textarea.value = null;

  await nextTick()
  const height = rongMessageListRef.value!.clientHeight - rongMessageBoxRef.value!.clientHeight + 9.5
  scrollbarRef.value?.setScrollTop(height);
}


</script>

<template>
  <el-container class="rong-container">
    <el-header style="padding: 0;">
      <el-menu
        :default-active="activeIndex"
        class="el-menu-demo"
        mode="horizontal"
        background-color="#545c64"
        text-color="#fff"
        active-text-color="#ffd04b"
        :ellipsis="false"
        @select="handleSelect"
      >
        <el-menu-item>RongCloud</el-menu-item>
        <div class="flex-grow" />
        <el-menu-item index="1">单群聊</el-menu-item>
        <el-menu-item index="2">聊天室</el-menu-item>
      </el-menu>
    </el-header>
    <el-container class="rong-container-boy">
      <el-aside>
        <ul class="rong-conversation-list">
          <li class="rong-conversation" v-for="(item, index) in localConversationList" :key="index" @click="selectConversation(item)">
            <el-badge :value="item.unreadMessageCount" :hidden="item.unreadMessageCount === 0" class="item">
              <el-avatar> user </el-avatar>
            </el-badge>
            <div class="rong-conversation-content">
              <span>{{ item.targetId }}</span>
              <p class="rong-conversation-laster-message">{{ item.latestMessage?.content.content }}</p>
            </div>
          </li>
        </ul>
      </el-aside>
      <el-container>
        <el-main style="overflow: hidden;">
          <el-card class="box-card" :body-style="cardCss">
            <template #header>
              <div class="card-header">
                <span>{{ currentConversation?.targetId || '未选择会话'}}</span>
              </div>
            </template>
            <template #default>
              <div ref="rongMessageBoxRef" style="height: 100%;">
                <el-scrollbar ref="scrollbarRef" @scroll="scroll">
                  <ul ref="rongMessageListRef" class="rong-message-list">
                    <li class="rong-message" v-for="(message, index) in localMessageList">
                      <el-avatar> user </el-avatar>
                      <div :class="message.messageDirection === 1? 'active' : ''" class="rong-message-content">
                        <pre>{{ message.content }}</pre>
                      </div>
                    </li>
                  </ul>
                </el-scrollbar>
              </div>

            </template>
            
          </el-card>
        </el-main>
        <el-footer height="200px" style="padding-bottom: 20px;">
          <el-card class="box-card rong-editor-box" :body-style="{ padding: '10px' }">
            <template #header>
              <div class="card-header">
                <div>
                  <el-button color="#f3d19e" type="primary" :icon="PictureFilled" circle />
                </div>
                <el-button color="#626aef" type="primary" @click="sendMessageHandle" :icon="Promotion" />
              </div>
            </template>
            <el-input
              v-model="textarea"
              :rows="5"
              type="textarea"
              resize="none"
              placeholder="Please input"
            />
          </el-card>  
        </el-footer>
      </el-container>
    </el-container>
  </el-container>
</template>

<style scoped>
.rong-container {
  width: 100%;
  height: 100%;
}
.rong-container-boy {
  height: calc(100% - 60px);
}
.flex-grow {
  flex-grow: 1;
}
.rong-conversation-list {
  padding: 20px 10px;
  height: 100%;
  box-sizing: border-box;
}
.rong-conversation {
  width: 100%;
  padding: 5px;
  border-bottom: 1px solid #545c64;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.rong-conversation-content {
  margin-left: 20px;
  flex: 1;
  overflow: hidden;
}
.rong-conversation-laster-message {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  -o-text-overflow: ellipsis;
  color: #c8c9cc;
}
.box-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.box-card .el-card__body {
  flex: 1;
  padding: 10px;
}
.rong-message {
  display: flex;
  align-items: start;
  margin-bottom: 10px;
}
.rong-message-content{
  max-width: 70%;
  margin-left: 10px;
  padding: 10px;
  background: #dedfe0;
  border-radius: 10px;
}
.rong-message-content.active {
  background-color: #626aef;
}
.rong-message-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.rong-editor-box .card-header{
  margin: -10px;
  display: flex;
  justify-content: space-between;
}
</style>
