<script setup lang="ts">
// import HelloWorld from './components/HelloWorld.vue'
import { onBeforeMount, ref, nextTick } from 'vue'
import { PictureFilled, Promotion, Delete, MoreFilled } from '@element-plus/icons-vue'
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
  IExpansionListenerData,
  IReadReceiptReceivedEvent,

  init,
  addEventListener,
  connect,
  getConversationList,
  clearMessagesUnreadStatus,
  sendSyncReadStatusMessage,
  getHistoryMessages,
  sendMessage,
  TextMessage,
  deleteMessages,
  recallMessage,
  updateMessageExpansion,
  sendReadReceiptMessage,
  getChatroomHistoryMessages,
joinChatRoom,
} from '@rongcloud/imlib-next'

const activeIndex = ref('1');
const textarea = ref();
const pullOfflineMessageFinished = ref<boolean>(false);
let loading: any;

const handleSelect = (key: string, keyPath: string[]) => {
  console.log(key, keyPath)
  activeIndex.value = key
  currentChatroom.value = {}
  currentConversation.value = undefined
  localMessageList.value = []
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
// 当前登入的用户 id
const currentUserId = ref<string>()
// 当前会话已读时间
const currentUnreadInfo = ref<any>({
  messageUId: '',
  sentTime: 1,
})
// 本地聊天室列表
const localChatroomList = ref([
  { targetId: 'Chatroom01', name: '西游记' },
  { targetId: 'Chatroom02', name: '葫芦娃救爷爷' }
])
const currentChatroom = ref()

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
      if (!localConversationList.value) {
        return
      }
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
  addEventListener(Events.EXPANSION, (evt: IExpansionListenerData) => {
    console.log('IExpansionListenerData', evt)
    if (!localMessageList.value) {
      return
    }
    const index: number = localMessageList.value!.findIndex((item) => item.messageUId === evt.updatedExpansion?.messageUId);
    if (index < 0) {
      return
    }
    localMessageList.value![index].expansion = evt.updatedExpansion?.expansion;
  })
  addEventListener(Events.READ_RECEIPT_RECEIVED, (evt: IReadReceiptReceivedEvent) => {
    console.log('IReadReceiptReceivedEvent', evt)
    // ${evt.conversation.conversationType}-${evt.conversation.targetId}-
    const key = `${(window as any).APPKEY}-${currentUserId.value}-RECEIVED`
    const data = localStorage.getItem(key);
    if (data) {
      const newData = { ...JSON.parse(data), [`${evt.conversation.conversationType}-${evt.conversation.targetId}`]: {
        messageUId: evt.messageUId,
        sentTime: evt.sentTime,
      }}
      localStorage.setItem(key, JSON.stringify(newData));
    }
    localStorage.setItem(key, JSON.stringify({
      [`${evt.conversation.conversationType}-${evt.conversation.targetId}`]: {
        messageUId: evt.messageUId,
        sentTime: evt.sentTime,
      }
    }));
    if (evt.conversation.targetId === currentConversation.value?.targetId && evt.conversation.conversationType === currentConversation.value?.conversationType) {
      currentUnreadInfo.value = evt
    }
  })
  addEventListener(Events.PULL_OFFLINE_MESSAGE_FINISHED, async () => {
    pullOfflineMessageFinished.value = true;
    // 关闭遮罩层
    loading.close();
    const { code, data } = await getConversationListHandle();
    console.log('data', data)
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
    currentUserId.value = data?.userId;
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

/**
 * 
 * 选中会话 - 清楚会话未读数 - 发送消息回执
 */
const selectConversation = async (con: IAReceivedConversation, index: number) => {
  currentConversation.value = con;
  const conversationType = con.conversationType;
  const targetId = con.targetId;

  if (con.unreadMessageCount) {
    // 多端未读数同步
    const { code } = await clearMessagesUnreadStatus({ conversationType, targetId });
    if (code !== ErrorCode.SUCCESS) {
      return
    }
    sendSyncReadStatusMessage({ conversationType, targetId }, Date.now());
    sendReadReceiptMessage(targetId, con.latestMessage?.messageUId || '', Date.now())
    localConversationList.value![index].unreadMessageCount = 0
  }
  
  const { code: code1, data } = await getHistoryMessagesHandle({ conversationType, targetId });
  if (code1 !== ErrorCode.SUCCESS) {
    return
  }
  console.log('localMessageList', data)
  localMessageList.value = data?.list
  // await nextTick();
  const height = rongMessageListRef.value!.clientHeight - rongMessageBoxRef.value!.clientHeight + 9.5
  scrollbarRef.value?.setScrollTop(height);

  const key = `${(window as any).APPKEY}-${currentUserId.value}-RECEIVED`;
  const lolRECEIVED = localStorage.getItem(key);
  if (lolRECEIVED) {
    currentUnreadInfo.value = JSON.parse(lolRECEIVED!)[`${con.conversationType}-${con.targetId}`] ||  {
    messageUId: '',
    sentTime: 0,
  }
    return
  }
  currentUnreadInfo.value = {
    messageUId: '',
    sentTime: 0,
  }

  console.log('currentUnreadInfo.value', currentUnreadInfo.value)
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
  let conversationType;
  let targetId;
  if (activeIndex.value === '1') {
    conversationType = currentConversation.value!.conversationType;
    targetId = currentConversation.value!.targetId;
  } else{
    conversationType = 6
    targetId = currentChatroom.value.targetId;
  }
  const message = new TextMessage({ content: textarea.value });
  const options = {
    canIncludeExpansion: true,
    expansion: {
      recallMessage: JSON.stringify({
        status: false,
        user: currentUserId.value,
      })
    }
  }
  const { code, data } = await sendMessage({ conversationType, targetId }, message, options);
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

/**
 * IMLib 删除消息
 */

const deleteMessagesHandle = async (message: IAReceivedMessage, index: number) => {
  const conversationType = message.conversationType;
  const targetId = message.targetId;
  const { code } = await deleteMessages({ conversationType, targetId }, [{
    messageUId: message.messageUId,
    sentTime: message.sentTime,
    messageDirection: message.messageDirection
  }]);
  if (code === ErrorCode.SUCCESS) {
    ElNotification({
      title: 'Success',
      message: `Delete success: ${ message.messageUId }`,
      type: 'success',
    });
    localMessageList.value?.splice(index, 1)
    // localMessageList.value = localMessageList.value?.filter((item) => item.messageUId !== message.messageUId);
  }
}

/**
 * IMLib 撤回消息
 */
const recallMessageHandle = async (message: IAReceivedMessage, index: number) => {
  const { code, data } = await recallMessage({
    conversationType: message.conversationType,
    targetId: message.targetId,
  },message);
  if (code !== ErrorCode.SUCCESS) {
    return
  }
  ElNotification({
    title: 'Success',
    message: `Recall success: ${ message.messageUId }`,
    type: 'success',
  });
  localMessageList.value?.splice(index, 1)
  localMessageList.value?.push(data!)
  // localMessageList.value = localMessageList.value?.filter((item) => item.messageUId !== message.messageUId);
}

/**
 * IMLib 更新消息扩展
 */
const updateMessageExpansionHandle = async (message: IAReceivedMessage, index: number) => {
  console.log(message)
  const recallMessage = JSON.stringify({
    status: true,
    user: currentUserId.value 
  })
  const { code, data } = await updateMessageExpansion({ recallMessage }, message);
  if (code !== ErrorCode.SUCCESS) {
    return
  }
  localMessageList.value![index].expansion = { recallMessage }
}

const dropdownActive = ref<boolean>(false)
const visibleChangeHandle = (data: number) => {
  console.log('handleOpen', data, rongMessageListRef.value?.getElementsByClassName(`active${data}`)[0])
  const dropdownDom = rongMessageListRef.value?.getElementsByClassName(`active${data}`)[0]
  dropdownActive.value = !dropdownActive.value
  if (!dropdownDom) return
  if (dropdownActive.value) {
    dropdownDom!.setAttribute('style', 'display: block')
    return
  }
  dropdownDom!.setAttribute('style', 'display: none')
  // rongMessageListRef.value?.getElementsByClassName(`active${data}`)[0].setAttribute('style', 'display: block')
}

/**
 * IMLib 加入聊天室
 */
const joinChatRoomHandle = async (item: { targetId: string, name: string }) => {
  const { code } = await joinChatRoom(item.targetId, { count: -1 })
  if (code !== ErrorCode.SUCCESS) {
    return
  }
  ElNotification({
    title: 'Success',
    message: `Join success, ChatroomId : ${ item.targetId }`,
    type: 'success',
  })
  const { code: code1, data } = await getChatroomHistoryMessages(item.targetId, {
    timestamp: 0,
    count: 20,
  })
  if (code1 !== ErrorCode.SUCCESS) {
    return
  }
  currentChatroom.value = item;
  localMessageList.value = data?.list;
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
        <ul v-if="activeIndex === '1'" class="rong-conversation-list">
          <li class="rong-conversation" v-for="(item, index) in localConversationList" :key="index" @click="selectConversation(item, index)">
            <el-badge :value="item.unreadMessageCount" :hidden="item.unreadMessageCount === 0" class="item">
              <el-avatar> user </el-avatar>
            </el-badge>
            <div class="rong-conversation-content">
              <span>{{ item.targetId }}</span>
              <p class="rong-conversation-laster-message">{{ item.latestMessage?.content.content }}</p>
            </div>
          </li>
        </ul>
        <ul v-else class="rong-conversation-list">
          <li class="rong-conversation" v-for="(item, index) in localChatroomList" :key="index" @click="joinChatRoomHandle(item)">
            <el-avatar> user </el-avatar>
            <div class="rong-conversation-content">
              <span>{{ item.targetId }}</span>
              <p class="rong-conversation-laster-message">{{ item.name }}</p>
            </div>
          </li>
        </ul>
      </el-aside>
      <el-container>
        <el-main style="overflow: hidden;">
          <el-card class="box-card" :body-style="cardCss">
            <template #header>
              <div class="card-header">
                <span v-if="activeIndex === '1'">{{ currentConversation?.targetId || '未选择会话'}}</span>
                <span v-else>{{ currentChatroom?.targetId || '未选择会话'}}</span>
              </div>
            </template>
            <template #default>
              <div ref="rongMessageBoxRef" style="height: 100%;">
                <el-scrollbar ref="scrollbarRef" @scroll="scroll">
                  <ul ref="rongMessageListRef" class="rong-message-list">
                    <li v-for="(message, index) in localMessageList" :key="index">
                      <el-divider v-if="message.expansion ? JSON.parse(message.expansion!.recallMessage).status : false" content-position="left">{{ JSON.parse(message.expansion!.recallMessage).user }} 撤回了一条消息</el-divider>
                      <div class="rong-message" v-else>
                        <el-avatar> user </el-avatar>
                        <div :class="message.messageDirection === 1? 'active' : ''" class="rong-message-content">
                          <pre>{{ message.content }}</pre>
                          
                        </div>
                        <div style="position: relative; width: 50px;">
                          <el-dropdown size="small" @visible-change="visibleChangeHandle(index)" :class="`active${index}`" class="messageHandle" trigger="click">
                            <el-button size="small" :icon="MoreFilled" />
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item @click="deleteMessagesHandle(message, index)">删除</el-dropdown-item>
                                <el-dropdown-item @click="recallMessageHandle(message, index)">撤回</el-dropdown-item>
                                <el-dropdown-item @click="updateMessageExpansionHandle(message, index)">撤回(扩展)</el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                          <span class="unread" v-if="activeIndex === '1' && message.messageDirection === 1 && currentUnreadInfo?.sentTime > message.sentTime">已读</span>
                          <span class="unread" v-if="activeIndex === '1' && message.messageDirection === 1 && currentUnreadInfo?.sentTime < message.sentTime">未读</span>
                        </div>
                        
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
  margin-bottom: 10px;
  align-items: stretch;
}
.rong-message-list .messageHandle {
  display: none;
  margin-left: 5px;
}
.rong-message:hover .messageHandle {
  display: block !important;
}
.rong-message .messageHandle.active {
  display: block;
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
.unread {
  display: inline-block;
  position: absolute;
  bottom: 0;
  left: 5px;
  font-size: 12px;
  width: 50px;
}
</style>
