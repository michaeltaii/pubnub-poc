import * as React from "react";
import {
  StyleSheet,
  ScrollView,
  Text,
  View,
  Button,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  Keyboard,
  TouchableOpacity,
  Alert,
} from "react-native";
import { usePubNub } from "pubnub-react";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
// import * as DocumentPicker from "react-native-document-picker";
import * as DocumentPicker from "expo-document-picker";

const Home = () => {
  const scrollViewRef = React.useRef();
  const pubnub = usePubNub();
  const [channels] = React.useState(["poc-channel"]);
  const [message, setMessage] = React.useState([]);
  const [isTyping, setIsTyping] = React.useState(false);
  const [text, setText] = React.useState("");
  const [userID, setUserID] = React.useState(uuidv4());
  // "ffb333d9-ebf7-4bfe-bd60-da839b0ff1ec"
  const [userTyping, setUserTyping] = React.useState(null);
  const [newChat, setNewChat] = React.useState(null);

  const eventListeners = {
    message: (envelope) => {
      console.log("envelope", envelope);

      if (envelope.message.messageType === "message") {
        setMessage((msgs) => [
          ...msgs,
          {
            messageId: envelope.timetoken,
            authorId: envelope.publisher,
            authorName: envelope.message.authorName,
            text: envelope.message.text,
            color: envelope.message.color,
            messageType: envelope.message.messageType,
            actionId: null,
          },
        ]);
      } else if (envelope.message.messageType === "announcement") {
        setNewChat(envelope.message.text);
      }

      // ? delivered message
      //  pubnub.addMessageAction({
      //    channel: channels[0],
      //    messageTimetoken: envelope.timetoken,
      //    action: {
      //      type: "receipt",
      //      value: 'delivered',
      //    },
      //  });
    },
    signal: (typing) => {
      // console.log(
      //   "channel name",
      //   typing.channel,
      //   "message",
      //   typing.message,
      //   "publisher",
      //   typing.publisher,
      //   "channelgroup",
      //   typing.subscription
      // );
      if (typing.message === "typing_on") {
        setUserTyping(typing.publisher);
      } else {
        setUserTyping(null);
      }
    },
    messageAction: (ma) => {
      // handle message action
      console.log("MA", ma, message);
      console.log(
        "the message timetoken",
        ma.data.messageTimetoken,
        ma.data.type,
        ma.data.value
      );

      if (ma.event === "added") {
        setMessage((msgs) => {
          const oldMsg = [...msgs];

          console.log("the old msg", oldMsg);

          const newMsg = oldMsg.map(
            ({ messageId, color, actionId, ...msg }) => ({
              ...msg,
              messageId,
              color:
                messageId === ma.data.messageTimetoken ? ma.data.value : color,
              actionId:
                messageId === ma.data.messageTimetoken
                  ? ma.data.actionTimetoken
                  : null,
            })
          );

          return newMsg;
        });
      } else if (ma.event === "removed") {
        console.log("remove action here");
        setMessage((msgs) => {
          const oldMsg = [...msgs];
          const newMsg = oldMsg.map(
            ({ messageId, color, actionId, ...msg }) => ({
              ...msg,
              messageId,
              color: messageId === ma.data.messageTimetoken ? "#fff" : color,
              actionId:
                messageId === ma.data.messageTimetoken ? null : actionId,
            })
          );
          return newMsg;
        });
      }
    },
    file: (event) => {
      if (event.message.messageType === "file") {
        let nameParts = event.file.name.split(".");
        let fileType = nameParts[nameParts.length - 1];
        console.log("the files", event, fileType);

        Alert.alert(
          "File uploaded",
          `A file named ${event.file.name} has been uploaded `,
          [{ text: "OK" }]
        );

        setMessage((msgs) => [
          ...msgs,
          {
            messageId: event.timetoken,
            authorId: event.publisher,
            authorName: event.message.authorName,
            text: event.file.name,
            messageType: event.message.messageType,
            uri: event.file.url,
            fileId: event.file.id,
            fileType: fileType,
          },
        ]);
      }
    },
  };

  const sendMessage = (input) => {
    if (input) {
      setIsTyping(false);
      const msg = {
        authorId: userID,
        authorName: userID.slice(0, 2),
        text: input,
        messageType: "message",
        // ? temporary var
        color: "#fff",
      };
      pubnub
        .publish({
          channel: channels[0],

          message: msg,
        })
        .then(() => setText(""));
    }
  };

  const sendAction = (action, timetoken, index) => {
    console.log(action, timetoken);

    if (message[index].actionId !== null) {
      console.log(message[index]);
      pubnub.removeMessageAction(
        {
          channel: channels[0],
          messageTimetoken: timetoken,
          actionTimetoken: message[index].actionId,
        },
        (status, response) => {
          console.log("remove action", status, response);
        }
      );
    } else {
      pubnub.addMessageAction({
        channel: channels[0],
        messageTimetoken: timetoken,
        action: {
          type: "change color",
          value: action,
        },
      });
    }
  };

  const sendFile = async () => {
    try {
      let fileToUpload;
      let fileType;
      await DocumentPicker.getDocumentAsync({
        type: "*/*",
      }).then((response) => {
        if (response.type === "success") {
          let { name, size, uri } = response;
          let nameParts = name.split(".");
          fileType = nameParts[nameParts.length - 1];
          fileToUpload = response;
          // fileToUpload = {
          //   name: response.name,
          //   uri: response.uri,
          //   mimeType: response.mimeType,
          // };
          console.log(
            "file to upload",
            response,
            nameParts,
            fileType,
            fileToUpload
          );

          pubnub.sendFile(
            {
              channel: channels[0],
              message: {
                authorName: "MT",
                authorId: userID,
                messageType: "file",
                text: fileToUpload.name,
                fileType: fileType,
              },
              file: fileToUpload,
            },
            (status, response) => {
              console.log("upload", status, response);
            }
          );
        }
      });
    } catch (err) {
      console.log(err);
    }
  };

  React.useEffect(() => {
    pubnub.subscribe({ channels });
    pubnub.addListener(eventListeners);

    return () => {
      pubnub.removeListener(eventListeners);

      pubnub.unsubscribeAll();
    };
  }, [pubnub]);

  React.useEffect(() => {
    if (isTyping) {
      pubnub.signal({
        message: "typing_on",
        channel: channels[0],
      });
    } else {
      pubnub.signal({
        message: "typing_off",
        channel: channels[0],
      });
    }
  }, [isTyping]);

  React.useEffect(() => {
    if (message.length > 0) {
      setNewChat(null);
    }
    // console.log("total messages", message);
  }, [message]);

  React.useEffect(() => {
    console.log("user id", userID);
    pubnub.setUUID(userID);

    let curMsgAction;
    pubnub.getMessageActions(
      {
        channel: channels[0],
        end: "16445741437322961",
      },
      (status, response) => {
        curMsgAction = response.data;

        console.log("existing message action", curMsgAction);
        pubnub.fetchMessages(
          {
            channels: channels,
            end: "16445741437322961",
            count: 25,
          },
          (status, response) => {
            console.log(response.channels["poc-channel"]);
            if (response.channels["poc-channel"]) {
              response.channels["poc-channel"].forEach((res) => {
                if (res.message.messageType === "message") {
                  // console.log("message type msg", res);
                  let messageAction = null;
                  let actionID = null;
                  curMsgAction.forEach((tmp) => {
                    if (tmp.messageTimetoken === res.timetoken) {
                      if (tmp.type === "change color") {
                        messageAction = tmp.value;
                        actionID = tmp.actionTimetoken;
                      }
                    }
                  });

                  if (messageAction) {
                    setMessage((msgs) => [
                      ...msgs,
                      {
                        messageId: res.timetoken,
                        authorId: res.uuid,
                        authorName: res.message.authorName,
                        text: res.message.text,
                        color: messageAction,
                        type: res.message.messageType,
                        actionId: actionID,
                      },
                    ]);
                  } else {
                    setMessage((msgs) => [
                      ...msgs,
                      {
                        messageId: res.timetoken,
                        authorId: res.uuid,
                        authorName: res.message.authorName,
                        text: res.message.text,
                        color: res.message.color,
                        type: res.message.messageType,
                        actionId: null,
                      },
                    ]);
                  }
                } else if (res.message.file) {
                  const { message: fileMsg } = res;
                  setMessage((msgs) => [
                    ...msgs,
                    {
                      messageId: res.timetoken,
                      authorId: res.uuid,
                      authorName: fileMsg.message.authorName,
                      text: fileMsg.file.name,
                      messageType: fileMsg.message.messageType,
                      uri: fileMsg.file.url,
                      fileId: fileMsg.file.id,
                      fileType: fileMsg.message.fileType,
                    },
                  ]);
                }
              });
            } else {
              pubnub.publish({
                message: {
                  authorId: null,
                  authorName: "system",
                  text: "Hello, this is an announcement. Welcome to the new chat",
                  messageType: "announcement",
                },
                channel: channels[0],
              });
            }
          }
        );
      }
    );
  }, []);

  // ? to hard clear message history temporary code

  // React.useEffect(() => {
  //   pubnub.deleteMessages(
  //     {
  //       channel: channels[0],
  //       start: "16445441437322961",
  //       end: "1645085173841305",
  //     },
  //     (status, response) => {
  //       console.log("clear message", status, response);
  //     }
  //   );
  // }, []);

  return (
    <SafeAreaView style={styles.outerContainer}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.innerContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.select({
            ios: 78,
            android: 0,
          })}
        >
          <ScrollView
            ref={scrollViewRef}
            onContentSizeChange={() =>
              scrollViewRef.current.scrollToEnd({ animated: true })
            }
          >
            {newChat ? (
              <Text style={{ textAlign: "center", marginTop: 10 }}>
                {newChat}
              </Text>
            ) : (
              <></>
            )}

            <View style={styles.topContainer}>
              {message.map((messages, index) => (
                <View key={messages.messageId} style={styles.messageContainer}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarContent}>
                      {messages.authorName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onLongPress={() => {
                      sendAction("red", messages.messageId, index);
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: `${messages.color}`,
                        padding: 15,
                        paddingTop: 15,
                        paddingBottom: 15,
                        borderRadius: 4,
                      }}
                    >
                      <Text>{messages.text}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          {userTyping ? <Text>{userTyping} is typing...</Text> : <></>}
          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={sendFile}>
              <View style={{ marginRight: 13 }}>
                <Text>+</Text>
              </View>
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={(x) => {
                if (x !== "") {
                  setIsTyping(true);
                } else {
                  setIsTyping(false);
                }
                setText(x);
              }}
              onSubmitEditing={() => sendMessage(text)}
              returnKeyType="send"
              enablesReturnKeyAutomatically={true}
              placeholder="Type your message here..."
            />
            <View style={styles.submitButton}>
              {text !== "" && (
                <Button title="Send" onPress={() => sendMessage(text)} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: "100%",
    height: "100%",
  },
  innerContainer: {
    width: "100%",
    height: "100%",
  },
  topContainer: {
    flex: 1,
    width: "100%",
    flexDirection: "column",
    justifyContent: "flex-end",
    // alignItems: "flex-end",
    paddingHorizontal: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginTop: 16,
    alignItems: "center",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 50,
    overflow: "hidden",
    marginRight: 16,
    backgroundColor: "pink",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarContent: {
    fontSize: 20,
    textAlign: "center",
    textAlignVertical: "center",
    justifyContent: "center",
  },
  messageContent: {
    // flex: 1,
    backgroundColor: "#fff",
    padding: 15,
    paddingTop: 15,
    paddingBottom: 15,
    borderRadius: 4,
  },
  bottomContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 16,
    elevation: 2,
  },
  submitButton: {
    position: "absolute",
    right: 32,
  },
});

export default Home;
