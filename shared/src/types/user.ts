export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDTO;
  token?: string;
  message?: string;
}
