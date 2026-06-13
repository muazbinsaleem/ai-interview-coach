import { useState, useRef } from 'react';
import { RecorderState } from '@/lib/types';

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const start = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setState('error');
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        }
      }
      setTranscript(final);
    };

    recognition.onend = () => setState('done');
    recognition.onerror = () => setState('error');

    recognition.start();
    recognitionRef.current = recognition;
    setState('recording');
    setTranscript('');
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setState('processing');
    setTimeout(() => setState('done'), 400);
  };

  const reset = () => {
    recognitionRef.current?.stop();
    setTranscript('');
    setState('idle');
  };

  return { state, transcript, setTranscript, start, stop, reset };
}
