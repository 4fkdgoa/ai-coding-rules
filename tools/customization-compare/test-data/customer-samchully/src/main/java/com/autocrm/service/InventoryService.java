package com.autocrm.service;

import com.autocrm.mapper.InventoryMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 재고 관리 서비스 - 삼천리 전용 커스터마이징
 * Base 프로젝트에는 없음
 */
@Service
public class InventoryService {

    @Autowired
    private InventoryMapper inventoryMapper;

    @Value("${inventory.warehouse.code}")
    private String warehouseCode;

    /**
     * 재고 조회 - 삼천리 창고 기준
     */
    public List<Inventory> getInventoryByWarehouse() {
        return inventoryMapper.findByWarehouseCode(warehouseCode);
    }

    /**
     * 재고 동기화 - 5분마다 실행
     */
    @Scheduled(fixedDelayString = "${inventory.sync.interval}000")
    public void syncInventory() {
        // 삼천리 ERP 시스템과 재고 동기화
        List<Inventory> erpInventory = fetchFromErp();
        inventoryMapper.bulkUpdate(erpInventory);
        log.info("재고 동기화 완료: {} 건", erpInventory.size());
    }

    private List<Inventory> fetchFromErp() {
        // 삼천리 ERP API 호출 로직
        // 실제로는 외부 API 연동
        return new ArrayList<>();
    }
}
