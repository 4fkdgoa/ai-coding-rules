package com.autocrm.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 전자결재 연동 서비스 - LG 전용 커스터마이징
 * Base 프로젝트에는 없음
 */
@Service
public class ApprovalService {

    @Value("${approval.api-url}")
    private String approvalApiUrl;

    @Value("${approval.api-key}")
    private String apiKey;

    @Autowired
    private RestTemplate restTemplate;

    /**
     * 결재 요청 생성 - LG 그룹웨어 연동
     */
    public String createApproval(ApprovalRequest request) {
        String url = approvalApiUrl + "/approvals";

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", apiKey);
        headers.set("Content-Type", "application/json");

        HttpEntity<ApprovalRequest> entity = new HttpEntity<>(request, headers);

        ApprovalResponse response = restTemplate.exchange(
            url,
            HttpMethod.POST,
            entity,
            ApprovalResponse.class
        ).getBody();

        return response.getApprovalId();
    }

    /**
     * 결재 상태 조회
     */
    public ApprovalStatus getApprovalStatus(String approvalId) {
        String url = approvalApiUrl + "/approvals/" + approvalId;

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", apiKey);

        HttpEntity<?> entity = new HttpEntity<>(headers);

        ApprovalResponse response = restTemplate.exchange(
            url,
            HttpMethod.GET,
            entity,
            ApprovalResponse.class
        ).getBody();

        return response.getStatus();
    }

    /**
     * 결재선 조회 - LDAP 조직도 기반
     */
    public List<Approver> getApprovalLine(String userId, String approvalType) {
        // LG 조직도에서 결재선 자동 생성
        // 실제로는 LDAP 서비스와 연동
        return new ArrayList<>();
    }
}
