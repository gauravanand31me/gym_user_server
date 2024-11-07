export const sendPushNotification = async (expoPushToken, message) => {
    const body = {
        to: expoPushToken,
        sound: 'default',
        title: message.title,
        body: message.body,
        data: { someData: 'goes here' },
    };
  
    try {
        const response = await axios.post('https://exp.host/--/api/v2/push/send', body);
        return response.data;
    } catch (error) {
        console.error('Error sending push notification:', error.response ? error.response.data : error.message);
    }
  };