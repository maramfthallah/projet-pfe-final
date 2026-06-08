import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIChat from '../AIChat';

// Test cases
describe('AIChat Component', () => {
  it('should render input box and submit button correctly', () => {
    const { getByPlaceholderText, getByText } = render(<AIChat />);
    expect(getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(getByText('Send')).toBeInTheDocument();
  });

  it('should clear the input box after message submission', () => {
    const { getByPlaceholderText, getByText } = render(<AIChat />);
    const input = getByPlaceholderText('Type your message...');
    const sendButton = getByText('Send');

    fireEvent.change(input, { target: { value: 'Hello, AI!' } });
    fireEvent.click(sendButton);

    expect(input.value).toBe('');
  });
});