import { UserDTO } from './user';

export interface ChatMessageDTO {
  id: string;
  roomId: string;
  sender: UserDTO;
  content: string;
  createdAt: string;
}
