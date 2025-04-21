import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  IconButton,
  Slide,
  SlideProps,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GroupIcon from '@mui/icons-material/Group';

interface AnalyticsConsentProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 20,
    padding: theme.spacing(2),
    background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
    maxWidth: 500,
  },
}));

const FeatureBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: 12,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  marginRight: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 10,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
}));

const AcceptButton = styled(Button)(({ theme }) => ({
  borderRadius: 30,
  padding: '12px 32px',
  fontSize: '1.1rem',
  textTransform: 'none',
  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
  boxShadow: '0 3px 15px rgba(33, 150, 243, 0.3)',
  '&:hover': {
    background: 'linear-gradient(45deg, #1976D2 30%, #00BCD4 90%)',
    boxShadow: '0 5px 20px rgba(33, 150, 243, 0.4)',
  },
}));

const DeclineButton = styled(Button)(({ theme }) => ({
  borderRadius: 30,
  padding: '12px 32px',
  fontSize: '1rem',
  textTransform: 'none',
  color: theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
}));

const Transition = React.forwardRef<unknown, SlideProps>((props, ref) => (
  <Slide direction="up" ref={ref} {...props} />
));

Transition.displayName = 'Transition';

const AnalyticsConsent: React.FC<AnalyticsConsentProps> = ({
  open,
  onAccept,
  onDecline,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <StyledDialog
      open={open}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Transition}
    >
      <IconButton
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500],
        }}
        onClick={onDecline}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <FavoriteIcon
            sx={{
              fontSize: 48,
              color: 'primary.main',
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.1)' },
                '100%': { transform: 'scale(1)' },
              },
            }}
          />
          <Typography variant="h5" sx={{ mt: 2, fontWeight: 600 }}>
            Help Make Clara Better! 💝
          </Typography>
          <Typography variant="body1" sx={{ mt: 1, color: 'text.secondary' }}>
            Would you like to help us improve Clara by sharing anonymous usage data?
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <FeatureBox>
            <IconWrapper>
              <SecurityIcon />
            </IconWrapper>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                100% Private & Secure
              </Typography>
              <Typography variant="body2" color="text.secondary">
                We never collect any personal information or sensitive data
              </Typography>
            </Box>
          </FeatureBox>

          <FeatureBox>
            <IconWrapper>
              <VisibilityOffIcon />
            </IconWrapper>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Completely Anonymous
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No IP addresses or identifiable information is ever tracked
              </Typography>
            </Box>
          </FeatureBox>

          <FeatureBox>
            <IconWrapper>
              <GroupIcon />
            </IconWrapper>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Community Driven
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Help us understand how to make Clara better for everyone
              </Typography>
            </Box>
          </FeatureBox>
        </Box>

        {showDetails && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              What we collect:
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li>Anonymous app usage statistics</li>
                <li>Feature interaction patterns</li>
                <li>Error reports (without personal data)</li>
                <li>Basic system info (OS type, app version)</li>
              </Box>
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <AcceptButton
            fullWidth
            variant="contained"
            onClick={onAccept}
            startIcon={<FavoriteIcon />}
          >
            Yes, I'll help improve Clara
          </AcceptButton>
          <DeclineButton onClick={onDecline}>
            No thanks
          </DeclineButton>
          <Button
            variant="text"
            size="small"
            onClick={() => setShowDetails(!showDetails)}
            sx={{ color: 'text.secondary' }}
          >
            {showDetails ? 'Hide details' : 'View details'}
          </Button>
        </Box>
      </DialogContent>
    </StyledDialog>
  );
};

export default AnalyticsConsent; 