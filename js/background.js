class Server {
  constructor() {
    this.vmAddr = "34.16.185.58:8766";
    this.socket = null;
  }

  openConnection() {
      this.socket = new WebSocket(`ws://${this.vmAddr}`);
      this.socket.onopen = () => {
          console.log("Connected to Server.");
      };

      this.socket.onmessage = (event) => {
        const response = event.data;
        console.log("Received response: " + response);
        if (this.callback) {
            this.callback(response);
        }
      };

      this.socket.onclose = () => {
        // console.log("Server Connection closed.");
      };
  }

  sendMessage(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(data);
    } else {
        console.error("Socket not opened");
    }
  }
}

class Extension {
    constructor() {
      this.name = "RansomMailDefender";
      this.toggleButton = false;
      this.authorizeState = false;
      this.fileId = null;
      this.isRunning = false;
      this.tabLoadTime = Date.now();

      this.clientId = 'YOUR_CLIENT_ID'; 
      this.scopes = [
        "https://mail.google.com/",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.addons.current.message.metadata",
        "https://www.googleapis.com/auth/gmail.metadata",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/cloud-platform"
      ];
      this.authURL = 'https://accounts.google.com/o/oauth2/auth';
      this.redirectURL = chrome.identity.getRedirectURL();
      this.accessToken = null;
      this.bucketName = "ransommaildefenderstrg";
      
      this.state = {
        currentUI: "default",
        progressPercentage: 0,
        result: null,
        title: null,
        category: null,
      };

      this.server = new Server(this.processMessage.bind(this));
  
    }


    //SERVER
    processMessage(response){

        if (response.status === "clean"){
            this.setState({ currentUI: "clean", title: response.subject });
            this.updatePopup(this.state);
        }else if (response.status === "malicious"){
            this.setState({ currentUI: "malicious", title: response.subject, result: "Unknown" });
            this.updatePopup(this.state);
        }else if (response.status === "ransomware"){
            this.setState({ currentUI: "malicious", title: response.subject, result: "Ransomware", category: response.category});
            this.updatePopup(this.state);
        }
    }

    initialize() {

      console.log(this.state);
      this.server.openConnection(); // SERVER
      // this.server.sendMessage("Testing!!!");

      chrome.storage.sync.get('toggleState', (data) => {
        this.toggleState = data.toggleState ? data.toggleState === 'checked' : false;
      });
      chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'toggleStateChange') {
              this.toggleState = message.state === 'checked';
              chrome.storage.sync.set({ toggleState: this.toggleState ? 'checked' : 'unchecked' },);
          }
      });

      chrome.storage.local.get('extensionState', function(result) {
        if (result.extensionState) {
            handleUIUpdate(result.extensionState);
        }
      });
  
      if (!this.authorizeState && !this.accessToken) {
          this.authorize(); 
          this.authorizeState = true;
      }else if (this.accessToken){
        this.authorizeState = true;
      }
      console.log(this.authorizeState);

      this.startExecution();
    }
    
    async startExecution() {
      setInterval(async () => {
          if (this.toggleState && this.authorizeState) {
            await this.detectActivities();
            // console.log("Activity detected");
          }
      }, 5000);
    }


    async authorize() {
      const authOptions = {
          url: `${this.authURL}?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectURL)}&response_type=token&scope=${encodeURIComponent(this.scopes.join(' '))}`,
          interactive: true,
      };
      console.log(authOptions);
  
      try {
          const responseURL = await chrome.identity.launchWebAuthFlow(authOptions);
          const responseParams = new URLSearchParams(responseURL.split('#')[1]);
          this.accessToken = responseParams.get('access_token');
  
          if (this.accessToken) {
              console.log('Access token obtained:', this.accessToken);
          } else {
              console.error('Access token not found in the response URL.');
          }
      } catch (error) {
          console.error('Authorization failed:', error);
      }
    }

    handleUIUpdate(extensionState) {
      this.state = extensionState;
      this.updatePopup(extensionState); 
    }

    updatePopup(data) {
        chrome.runtime.sendMessage({
            action: "updateUI",
            data: data
        },
        () => {
          if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError.message); // check error
          }
        }
      );
    }

    setState(newState) {
      this.state = { ...this.state, ...newState };
      chrome.storage.local.set({ extensionState: this.state });
    }
  
    async detectActivities() {
      console.log("Detection running status: " + this.isRunning);
      if (this.isRunning === 'true' || this.toggleButton === 'false') return;
  
      const activeTab = await this.getActiveTab();
      if (!activeTab.url.includes('mail.google.com')) {
          console.log("Not on mail.google.com. Skipping activity detection.");
          return;
      }
    //   const emailIdFromGmailUrl = this.extractEmailId(activeTab.url);
    //   if(emailIdFromGmailUrl) {
    //       console.log("Active ID:", emailIdFromGmailUrl);
    //   }
      
      this.isRunning = true;
      
      try {
          const activity = await Promise.race([
            // this.getDownloadActivity(),
            // this.getIncomingMail(),
            // this.getRedirectLink(),

            this.getDownloadActivity().then(val => { console.log("getDownloadActivity resolved with:", val); return val; }),
            this.getIncomingMail().then(val => { console.log("getIncomingMail resolved with:", val); return val; }),
            this.getRedirectLink().then(val => { console.log("getRedirectLink resolved with:", val); return val; }),
          ]);
          const emailId = await this.getEmailId();
          console.log(emailId + " iniii");
  
          if (activity) {
              const emailId = await this.getEmailId();
              this.setState({ currentUI: "completed" });
              this.updatePopup(this.state);
              if (emailId) {  
                await this.parseMail(emailId);
                this.setState({ currentUI: "completed" });
                this.updatePopup(this.state);
              } else {
                  console.log("Email ID is null.");
              }
          }else {
            console.log("No activity detected.");
          }
      } catch (error) {
          console.error("An error occurred:", error);
      }
  
      this.isRunning = false;
      console.log("[END] Detection running status: " + this.isRunning);
    }
    
    
    async getActiveTab() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length) {
                    resolve(tabs[0]);
                } else {
                    reject(new Error("No active tab found."));
                }
            });
        });
    }
    
    async getDownloadActivity() {
        return new Promise((resolve) => {
            chrome.downloads.onChanged.addListener((downloadDelta) => {
                if (downloadDelta.state && downloadDelta.state.current === "complete") {
                    resolve("download");
                }
            });
        });
    }
    
    async getIncomingMail() {
      if (this.toggleButton === 'false') {
          return null;
      }
  
      try {
        const response = await fetch(
            "https://www.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=1",
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to retrieve incoming mail: ${response.statusText}`);
        }

        const data = await response.json();
        if (data && data.messages && data.messages.length > 0) {
            const messageId = data.messages[0].id;

            const messageResponse = await fetch(
                `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                    },
                }
            );

            const messageData = await messageResponse.json();
            if (messageData && parseInt(messageData.internalDate) > this.tabLoadTime) {
                return "mail";
            }
        }

        return null;
      } catch (error) {
          console.error(`Failed to retrieve incoming mail: ${error.message}`);
          return null;
      }
    }
  
    
    async getRedirectLink() {
      return new Promise((resolve) => {
          const listener = (details) => {
              if (details.type === "main_frame") { 
                  chrome.webRequest.onBeforeRequest.removeListener(listener);
                  resolve("redirect");
              }
          };
  
          chrome.webRequest.onBeforeRequest.addListener(
              listener,
              { urls: ["<all_urls>"] }
          );
      });
    }
  

    async getEmailId() {
      const url = 'https://www.googleapis.com/gmail/v1/users/me/messages';
      const responseData = await this.fetchGmailData(url);
      return responseData.messages.map(message => message.id);
    }
    
    async parseMail() {
        const emailIds = await this.getEmailId();
        if (emailIds && emailIds.length > 0) {
            const emailId = emailIds[0];
            await this.processMessageId(emailId);
        }
    }
    
    async processMessageId(messageId) {
      const mailData = await this.fetchGmailData(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=METADATA`);
      const { payload } = mailData;
  
      const subjectHeader = payload.headers.find(header => header.name === 'Subject');
      if (!subjectHeader) {
          console.error('No Subject header found for email ID:', messageId);
          return;
      }
  
      const emailBodyData = this.extractEmailBody(payload);

      if (emailBodyData) {
          const emailContent = this.createEmlContent(subjectHeader.value, emailBodyData);
          await this.saveDataToGCS(emailContent, `${messageId}.eml`, messageId, 'email');
      } else {
          console.error('No body data found for email ID:', messageId);
          console.log('Payload:', payload);
          console.log('Payload parts:', payload.parts);
      }
  
      if (payload.parts) {
          const attachments = payload.parts.filter(part => part.filename && part.filename.length > 0);
          const attachmentPromises = attachments.map(async attachment => {
              const attachmentData = await this.fetchGmailData(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.body.attachmentId}`);
              if (attachmentData && attachmentData.data) {
                  const decodedAttachment = Buffer.from(attachmentData.data, 'base64').toString('utf-8');
                  return this.saveDataToGCS(decodedAttachment, attachment.filename, messageId, 'attachment');
              } else {
                  console.error('No attachment in email ID:', messageId);
              }
          });
          await Promise.all(attachmentPromises);
      }
  
      await this.updateIdJsonInGCS(messageId);
      console.log('Email parsed successfully.');
    }

    extractEmailBody(payload) {
      console.log("Processing payload:", payload);
      if (payload.body && payload.body.data) {
        return payload.body.data;
      } else if (payload.parts) {
          for (let part of payload.parts) {
              if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
                  if (part.body && part.body.data) {
                      return part.body.data;
                  }
              } else if (part.mimeType.startsWith('multipart/')) {
                  return this.extractEmailBody(part);
              } 
          }
      }
      return null;
    }
    
    async getMessageIdsFromThreadId(threadId) {
        const url = `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=METADATA`;
        const threadData = await this.fetchGmailData(url);
        return threadData.messages.map(message => message.id);
    }
    
    async fetchGmailData(url) {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
            },
        });
    
        if (!response.ok) {
            const responseBody = await response.text();
            throw new Error(`Failed to fetch Gmail data from: ${url}. Status: ${response.status}, Reason: ${responseBody}`);
        }
    
        return response.json();
    }

    // extractEmailId(url) {
    //     const messagePattern = /\/u\/\d+\/#inbox\/([\w-]+)/;
    //     const messageMatch = url.match(messagePattern);
    //     if (messageMatch && messageMatch[1]) {
    //         return messageMatch[1];
    //     }
    //     return null;
    // }
  
    async updateIdJsonInGCS(mailId) {
        try {
            const storage = new Storage();
            const bucket = storage.bucket(this.bucketName);
            const idJsonFile = bucket.file('id.json');
        
            const [idJsonExists] = await idJsonFile.exists();
            let idData = idJsonExists ? JSON.parse((await idJsonFile.download())[0].toString()) : {};
          
            idData[mailId] = mailId; 
            await idJsonFile.save(JSON.stringify(idData), { contentType: 'application/json' });
            
            console.log('id.json updated and saved to GCS successfully.');
        } catch (error) {
            console.error('Failed to update id.json in GCS:', error);
        }
      }
    
      
      async saveDataToGCS(data, filename, mailId) {
        try {
            const folderName = mailId;
            const destination = `${folderName}/${filename}`;
            const gcsApiEndpoint = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucketName}/o?uploadType=media&name=${encodeURIComponent(destination)}`;
    
            const headers = new Headers({
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/octet-stream',
            });

            const response = await fetch(gcsApiEndpoint, {
                method: 'POST',
                headers: headers,
                body: data,
            });

            if (!response.ok) {
                throw new Error(`Failed to save data to GCS. Status: ${response.status}`);
            }

            const responseBody = await response.json();
            console.log(`Saved data to GCS: ${responseBody.name}`);
            this.server.sendMessage({ id: folderName});
        } catch (error) {
            console.error('Failed to save data to GCS:', error);
        }
      }



   }

  const ext = new Extension();
  ext.initialize();