import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

interface SocketMessage {
	event: 'media' | 'mark' | 'clear'; 
  	media?: {
    	payload: string;
    	durationMs: number; // Duration of this audio packet in milliseconds, can also be explicitly calculated using Samples/Sample rate, samples = packet size/bit depth
  	};
  	mark?: {
    		name: string;
  	};
}

interface CallMediaQueueArgs {
  	streamSid: string;
  	socket: WebSocket;
}

class CallMediaQueue extends EventEmitter {
  
	private queue: SocketMessage[]; 
  	private isSending: boolean;
  	private streamSid: string;
  	private socket: WebSocket;
    	private currentVolume: number = 1.0; // Current volume at 100%

  	constructor(args: CallMediaQueueArgs) {
    		super();
    		this.queue = [];
    		this.isSending = false;
    		this.streamSid = args.streamSid;
    		this.socket = args.socket;

    		this.socket.on('message', async (message) => {
      			const data = JSON.parse(message.toString());
      
      			if (data.event === 'mark') {
        			this.emit('mark', data.mark.name); // Emit a 'mark' event with the name
      				}
    		});
  	}

  // Process the next message in the queue
  	private async processNext(): Promise<void> {
    		if (!this.isSending && this.queue.length > 0) {
      			this.isSending = true;
     			await this.sendNext(); // Send the next message
    		}
  	}

  // Send the next message in the queue
  	private async sendNext(): Promise<void> {
    		if (this.queue.length === 0) {
      			this.isSending = false; // Reset the sending flag
      			return; // Exit the function
    		}

    	const socketMessage = this.queue.shift()!;
    	try {
      		// Attempt to send the message with retries
      		await this.sendWithRetry(socketMessage);
      		const delayDuration = socketMessage.media?.durationMs || 0; // If successful, wait for the duration of the audio clip before sending the next one
      		await new Promise(resolve => setTimeout(resolve, delayDuration));
    	} 	catch (error) {
      		console.error('Failed to send packet after retries:', error); // Log the error if all retries fail
    		}

    	this.isSending = false;
    	this.processNext();
  }

  	// Attempt to send a message with retries in case of failure
  	private async sendWithRetry(socketMessage: SocketMessage, retries: number = 3, delay: number = 300): Promise<void> {
    		for (let attempt = 1; attempt <= retries; attempt++) {
      			try {
       			 	// Try to send the message
        			await this.sendToTwilio(socketMessage);
        			return; // Exit the function upon success
      			} 	catch (error) {
        			// Log the error and retry after a delay
        			console.error(`Attempt ${attempt} failed, retrying...`, error);
        			if (attempt < retries) {
          				// Wait for the specified delay before retrying
          				await new Promise(resolve => setTimeout(resolve, delay));
        			}
      			}
    		}
    	// If all retries fail, throw an error
    	throw new Error(`Failed to send packet after ${retries} retries.`);
  	}
  	// Send a message to Twilio (or any WebSocket server)
  	private async sendToTwilio(socketMessage: SocketMessage): Promise<void> {
    		return new Promise((resolve, reject) => {
      	// Send the message via WebSocket
      			this.socket.send(JSON.stringify({
        			event: socketMessage.event,
        			streamSid: this.streamSid,
        			media: socketMessage.media,
        			mark: socketMessage.mark,
      				}), error => {
        			if (error) reject(error); // Reject
        			else resolve(); // Otherwise, resolve the promise
      			});
    		});
  	}

  	public enqueue(mediaData: SocketMessage): void {
    		this.queue.push(mediaData); 
    		this.processNext(); 
  	}

  	public media(payload: string, durationMs: number): void {
    		this.enqueue({
      			event: 'media',
      			media: {
        			payload,
        			durationMs
      			},
    		});
  	}

  	public mark(name: string): void {
    		this.enqueue({
      			event: 'mark',
      			mark: { name },
    		});
  	}

  	public clear(): void {
    		this.sendToTwilio({ event: 'clear' });
    		this.queue = [];
  		}
	}

    setVolume(volume: number): void {
        if (volume < 0 || volume > 1) {
            throw new Error('Volume must be between 0 and 1');
        }
        this.currentVolume = volume;

    	private async sendNext(): Promise<void> {

export default CallMediaQueue;


