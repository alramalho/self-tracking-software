from typing import List, Optional
from datetime import datetime, timedelta, UTC

from entities.message import Message, Emotion
from gateways.database.mongodb import MongoDBGateway


class MessagesGateway:
    def __init__(self):
        self.db_gateway = MongoDBGateway("messages")

    def get_message_by_id(self, message_id: str) -> Optional[Message]:
        msgs = self.db_gateway.query("id", message_id)
        if len(msgs) > 0:
            return Message(**msgs[-1])
        return None

    def update_message(self, message: Message):
        self.db_gateway.write(message.dict())
        return message
    
    def get_latest_ai_message(self, user_id: str) -> Optional[Message]:
        msgs = self.db_gateway.query("recipient_id", user_id)
        msgs = [Message(**msg) for msg in msgs]
        msgs.sort(key=lambda x: x.created_at, reverse=True)
        return msgs[0] if msgs else None

    def get_recent_sent_messages(self, user_id: str, max_age_in_minutes: int, max_count: int) -> List[Message]:
        current_time = datetime.now(UTC)
        cutoff_time = current_time - timedelta(minutes=max_age_in_minutes)
        msgs = self.db_gateway.query("sender_id", user_id)
        recent_msgs = [
            Message(**msg) for msg in msgs
            if datetime.fromisoformat(msg['created_at']) > cutoff_time.replace(tzinfo=datetime.fromisoformat(msg['created_at']).tzinfo)
        ]
        recent_msgs.sort(key=lambda x: x.created_at, reverse=True)
        return recent_msgs[:max_count]
    

    def average_emotions(self, emotions: List[Emotion]) -> List[Emotion]:
        # Create dictionaries to store emotion properties by name
        emotion_scores = {}
        emotion_counts = {}
        emotion_colors = {}  # Add dictionary for colors

        print(f"Averaging emotions: {emotions}")
        
        # Aggregate scores and counts for each emotion
        for emotion in emotions:
            if emotion.name in emotion_scores:
                emotion_scores[emotion.name] += emotion.score
                emotion_counts[emotion.name] += 1
            else:
                emotion_scores[emotion.name] = emotion.score
                emotion_counts[emotion.name] = 1
                emotion_colors[emotion.name] = emotion.color  # Store the color
        
        # Calculate averages and create new Emotion objects
        averaged_emotions = [
            Emotion(
                name=name,
                score=emotion_scores[name] / emotion_counts[name],
                color=emotion_colors[name]  # Include the color in the new Emotion
            )
            for name in emotion_scores
        ]
        
        return averaged_emotions

    def get_all_messages_by_user(self, user_id: str) -> List[Message]:
        # Get messages where user is either sender or recipient
        msgs_as_sender = self.db_gateway.query("sender_id", user_id)
        msgs_as_recipient = self.db_gateway.query("recipient_id", user_id)
        
        all_messages = []
        
        # Add all messages where user is sender
        for msg in msgs_as_sender:
            all_messages.append(Message(**msg))
            
        # Add all messages where user is recipient
        for msg in msgs_as_recipient:
            # Only add if not already added (in case of self-messages)
            if msg.get('sender_id') != user_id:
                all_messages.append(Message(**msg))
                
        all_messages.sort(key=lambda x: x.created_at, reverse=True)
        return all_messages