import React from 'react';
import { Container, VStack, Heading, Text, Alert, AlertIcon, AlertDescription } from '@chakra-ui/react';

const MonitoringDashboard: React.FC = () => {
  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8}>
        <Heading as="h1" size="2xl" color="#1890FF">
          WordPecker 管理仪表板
        </Heading>
        
        <Text fontSize="lg" color="gray.400">
          后台管理功能已激活
        </Text>

        <Alert status="success" maxW="md">
          <AlertIcon />
          <AlertDescription>
            🎉 管理界面工作正常！
          </AlertDescription>
        </Alert>

        <Alert status="info" maxW="md">
          <AlertIcon />
          <AlertDescription>
            API地址: http://localhost:3000/api/management/
          </AlertDescription>
        </Alert>
      </VStack>
    </Container>
  );
};

export default MonitoringDashboard;
