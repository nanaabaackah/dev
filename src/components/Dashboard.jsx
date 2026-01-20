import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../api-url';

const Dashboard = () => {
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchKpiData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch(buildApiUrl('/api/dashboard'), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setKpiData(data);
        } else {
          if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
          }
          setError(data.error || 'Failed to fetch dashboard data');
        }
      } catch (err) {
        setError('Network error or server unavailable');
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchKpiData();
  }, [navigate]);

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">{error}</Alert>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </Container>
    );
  }

  if (!kpiData) {
    return (
      <Container className="mt-5">
        <Alert variant="info">No dashboard data available.</Alert>
      </Container>
    );
  }

  const renderStatusBadge = (status) => {
    let variant = 'secondary';
    if (status === 'ok') variant = 'success';
    else if (status === 'error' || status === 'offline') variant = 'danger';
    else if (status === 'degraded') variant = 'warning';
    return <span className={`badge bg-${variant}`}>{status}</span>;
  };

  const renderSiteStatus = (site) => (
    <div key={site.id} className="mb-3">
      <h5>{site.title} {renderStatusBadge(site.status)}</h5>
      <ul className="list-unstyled">
        {site.pages.map(page => (
          <li key={page.label}>
            {page.label}: {renderStatusBadge(page.status)}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Container className="mt-4">
      <h1 className="mb-4">KPI Dashboard</h1>

      <Row className="mb-4">
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Total Organizations</Card.Title>
              <Card.Text className="h3">{kpiData.totalOrganizations}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Total Users</Card.Title>
              <Card.Text className="h3">{kpiData.totalUsers}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Total Inventory Items</Card.Title>
              <Card.Text className="h3">{kpiData.totalInventoryItems}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Header>Portfolio Metrics</Card.Header>
            <Card.Body>
              <Card.Text>Organizations: {kpiData.portfolio.organizations}</Card.Text>
              <Card.Text>Users: {kpiData.portfolio.users}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Header>Reebs Metrics</Card.Header>
            <Card.Body>
              <Card.Text>Organizations: {kpiData.reebs.organizations}</Card.Text>
              <Card.Text>Users: {kpiData.reebs.users}</Card.Text>
              <Card.Text>Inventory: {kpiData.reebs.inventoryItems}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Header>Faako Metrics</Card.Header>
            <Card.Body>
              <Card.Text>Organizations: {kpiData.faako.organizations}</Card.Text>
              <Card.Text>Users: {kpiData.faako.users}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Header>API and DB Status</Card.Header>
            <Card.Body>
              <Card.Text>API: {renderStatusBadge(kpiData.status.api)}</Card.Text>
              <Card.Text>Portfolio DB: {renderStatusBadge(kpiData.status.portfolioDb)}</Card.Text>
              <Card.Text>Reebs DB: {renderStatusBadge(kpiData.status.reebsDb)}</Card.Text>
              <Card.Text>Faako DB: {renderStatusBadge(kpiData.status.faakoDb)}</Card.Text>
              <Card.Text>Last Synced: {new Date(kpiData.lastSyncedAt).toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header>Site Status</Card.Header>
            <Card.Body>
              <p>Last Checked: {kpiData.siteStatus.checkedAt ? new Date(kpiData.siteStatus.checkedAt).toLocaleString() : 'N/A'}</p>
              {kpiData.siteStatus.sites.map(renderSiteStatus)}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;
