import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Onboarding from './Onboarding';
import { db } from '../db';

// Mock the db module
vi.mock('../db', () => ({
  db: {
    updatePersonalInfo: vi.fn().mockResolvedValue(undefined),
    updateAPIConfig: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('Onboarding', () => {
  const onCompleteMock = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders the initial screen correctly', () => {
    render(<Onboarding onComplete={onCompleteMock} />);
    
    expect(screen.getByText('Welcome to Clara')).toBeInTheDocument();
    expect(screen.getByText("Let's get to know each other a little better")).toBeInTheDocument();
    expect(screen.getByText('What should I call you?')).toBeInTheDocument();
    
    // First step buttons
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
  
  it('enables the next button when name is entered', () => {
    render(<Onboarding onComplete={onCompleteMock} />);
    
    const nameInput = screen.getByPlaceholderText('Your name');
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });
  
  it('moves through all steps correctly', async () => {
    render(<Onboarding onComplete={onCompleteMock} />);
    
    // Step 1: Enter name
    const nameInput = screen.getByPlaceholderText('Your name');
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    
    // Step 2: Enter email
    await waitFor(() => {
      expect(screen.getByText('How can I reach you?')).toBeInTheDocument();
    });
    
    const emailInput = screen.getByPlaceholderText('your.email@example.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    
    // Step 3: Confirm timezone
    await waitFor(() => {
      expect(screen.getByText("What's your timezone?")).toBeInTheDocument();
    });
    
    // Check timezone exists but don't change it
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    
    // Complete onboarding
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
    
    // Verify database calls
    await waitFor(() => {
      expect(db.updatePersonalInfo).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        timezone: expect.any(String),
        theme_preference: 'system',
        avatar_url: ''
      });
      
      expect(db.updateAPIConfig).toHaveBeenCalledWith({
        ollama_base_url: '',
        openai_key: '',
        openrouter_key: ''
      });
      
      expect(onCompleteMock).toHaveBeenCalled();
    });
  });
  
  it('allows going back to previous steps', async () => {
    render(<Onboarding onComplete={onCompleteMock} />);
    
    // Step 1: Enter name
    const nameInput = screen.getByPlaceholderText('Your name');
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    
    // Step 2: Enter email
    await waitFor(() => {
      expect(screen.getByText('How can I reach you?')).toBeInTheDocument();
    });
    
    // Go back to step 1
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    
    // Verify we're back to step 1
    await waitFor(() => {
      expect(screen.getByText('What should I call you?')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });
  });
});
