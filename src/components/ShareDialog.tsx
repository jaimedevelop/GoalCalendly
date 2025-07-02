import React, { useState } from 'react';
import { Goal } from '../types';
import { Copy, Check, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { storeSharedGoals } from '../services/db';

interface ShareDialogProps {
  onClose: () => void;
  goals: Goal[];
}

export function ShareDialog({ onClose, goals }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  
  const generateShareUrl = async () => {
    const shareId = crypto.randomUUID();
    await storeSharedGoals(shareId, goals);
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${shareId}`;
  };

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  
  React.useEffect(() => {
    generateShareUrl().then(setShareUrl);
  }, [goals]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!shareUrl) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>Generating share link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Share Goals</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Scan QR Code</h3>
            <p className="text-sm text-gray-600 mb-4">
              Scan this QR code with another device to download your goals directly.
            </p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Share Link</h3>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 p-2 text-sm bg-white border rounded font-mono text-xs"
              />
              <button
                onClick={handleCopy}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
                title={copied ? 'Copied!' : 'Copy to clipboard'}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}